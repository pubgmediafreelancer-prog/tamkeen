import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { retrieveKnowledge, retrievePrograms } from "@/lib/ai/retrieval";
import { generateReply, extractProfileUpdates, isAiConfigured, ChatTurn } from "@/lib/ai/chat";
import { scoreLead, requiresHumanFollowup } from "@/lib/leads/scoring";
import { notifyN8n } from "@/lib/n8n/notify";
import { StudentProfile } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  sessionId: z.string().min(8).max(128),
  message: z.string().min(1).max(4000),
  attribution: z
    .object({
      landing_page: z.string().optional(),
      referrer: z.string().optional(),
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
    })
    .optional(),
});

function profileFromLead(lead: Record<string, unknown> | null): StudentProfile {
  if (!lead) return {};
  const profile: StudentProfile = {};
  const keys: (keyof StudentProfile)[] = [
    "first_name",
    "last_name",
    "nationality",
    "country_of_residence",
    "education_level",
    "certificate_type",
    "percentage",
    "graduation_year",
    "desired_level",
    "desired_faculty",
    "desired_program",
    "intended_start",
    "phone",
    "email",
    "preferred_language",
  ];
  for (const k of keys) {
    const v = lead[k];
    if (v !== null && v !== undefined && v !== "") (profile as Record<string, unknown>)[k] = v;
  }
  return profile;
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example) to enable the admissions assistant.",
      },
      { status: 500 }
    );
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured. The AI Admission Agent cannot generate responses without it (see .env.example).",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { sessionId, message, attribution } = parsed.data;

  const supabase = getSupabaseAdmin();

  // 1. Identify session / existing lead (a lead row is created from the
  // first message so every chat session is trackable end-to-end).
  const { data: existingLead } = await supabase
    .from("leads")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  const isNewLead = !existingLead;

  // 2. Prior conversation for this session (for AI memory + extraction).
  const { data: priorRows } = await supabase
    .from("conversations")
    .select("role,message")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(30);

  const history: ChatTurn[] = (priorRows ?? [])
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.message }));
  history.push({ role: "user", content: message });

  // 3. Retrieval — structured programs + knowledge base, scoped to the
  // latest message (the strongest signal of current intent).
  const [knowledge, programs] = await Promise.all([
    retrieveKnowledge(message),
    retrievePrograms(message),
  ]);

  const currentProfile = profileFromLead(existingLead);

  // 4. Generate the assistant reply grounded in verified context only.
  const reply = await generateReply(history, knowledge, programs, currentProfile);

  // 5. Best-effort structured extraction of new profile facts.
  const extracted = await extractProfileUpdates(history, currentProfile);
  const mergedProfile: StudentProfile = { ...currentProfile, ...extracted };

  const leadScore = scoreLead(mergedProfile);
  const followup = requiresHumanFollowup(mergedProfile, message);

  const wasHot = existingLead?.lead_score === "HOT";
  const isNowHot = leadScore === "HOT";

  // 6. Upsert the lead record.
  const leadUpdate: Record<string, unknown> = {
    session_id: sessionId,
    first_name: mergedProfile.first_name,
    last_name: mergedProfile.last_name,
    nationality: mergedProfile.nationality,
    country_of_residence: mergedProfile.country_of_residence,
    education_level: mergedProfile.education_level,
    certificate_type: mergedProfile.certificate_type,
    percentage: mergedProfile.percentage,
    graduation_year: mergedProfile.graduation_year,
    desired_level: mergedProfile.desired_level,
    desired_faculty: mergedProfile.desired_faculty,
    desired_program: mergedProfile.desired_program,
    intended_start: mergedProfile.intended_start,
    primary_phone: mergedProfile.phone,
    email: mergedProfile.email,
    preferred_language: mergedProfile.preferred_language ?? "en",
    lead_score: leadScore,
    lead_status: isNewLead ? "NEW" : leadScore === "COLD" ? existingLead?.lead_status : "QUALIFIED",
    human_followup_required: followup.required,
    human_followup_reason: followup.reason ?? null,
    source: existingLead?.source ?? "ai_chat",
    landing_page: existingLead?.landing_page ?? attribution?.landing_page ?? null,
    referrer: existingLead?.referrer ?? attribution?.referrer ?? null,
    utm_source: existingLead?.utm_source ?? attribution?.utm_source ?? null,
    utm_medium: existingLead?.utm_medium ?? attribution?.utm_medium ?? null,
    utm_campaign: existingLead?.utm_campaign ?? attribution?.utm_campaign ?? null,
    utm_content: existingLead?.utm_content ?? attribution?.utm_content ?? null,
    utm_term: existingLead?.utm_term ?? attribution?.utm_term ?? null,
  };
  // Strip undefined so we never null-out a previously known field.
  Object.keys(leadUpdate).forEach((k) => leadUpdate[k] === undefined && delete leadUpdate[k]);

  const { data: savedLead, error: leadError } = await supabase
    .from("leads")
    .upsert(leadUpdate, { onConflict: "session_id" })
    .select()
    .single();

  if (leadError) {
    console.error("Failed to upsert lead:", leadError.message);
  }

  // 7. Store both sides of the turn.
  const sourcesUsed = [
    ...knowledge.map((k) => ({ title: k.title, source_url: k.source_url })),
    ...programs.map((p) => ({ title: p.program_name, source_url: p.source_url })),
  ];

  await supabase.from("conversations").insert([
    { session_id: sessionId, lead_id: savedLead?.id, role: "user", message, sources_used: [] },
    {
      session_id: sessionId,
      lead_id: savedLead?.id,
      role: "assistant",
      message: reply,
      sources_used: sourcesUsed,
    },
  ]);

  // 8. Fire funnel + n8n events (never block the response on these).
  if (isNewLead && savedLead) {
    notifyN8n("lead_created", { lead: savedLead });
    supabase
      .from("application_events")
      .insert({ lead_id: savedLead.id, event_type: "lead_created", metadata: { source: "ai_chat" } })
      .then(() => {});
  }
  if (!wasHot && isNowHot && savedLead) {
    notifyN8n("hot_lead", { lead: savedLead, reason: "Lead score transitioned to HOT" });
  }

  return NextResponse.json({
    reply,
    sessionId,
    leadScore,
    humanFollowupRequired: followup.required,
    humanFollowupReason: followup.reason ?? null,
  });
}
