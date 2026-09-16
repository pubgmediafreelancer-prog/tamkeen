import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { notifyN8n } from "@/lib/n8n/notify";

export const runtime = "nodejs";

const ApplicationSchema = z.object({
  sessionId: z.string().min(8),
  applicationId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  status: z
    .enum([
      "DRAFT",
      "IN_PROGRESS",
      "READY_FOR_REVIEW",
      "SUBMITTED",
      "NEEDS_DOCUMENTS",
      "UNDER_REVIEW",
      "ADMISSION_DECISION",
      "ENROLLED",
      "REJECTED",
      "WITHDRAWN",
    ])
    .default("IN_PROGRESS"),
  formData: z.record(z.string(), z.unknown()).default({}),
});

function generateApplicationNumber() {
  const y = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SDU-${y}-${rand}`;
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { sessionId, applicationId, programId, status, formData } = parsed.data;
  const supabase = getSupabaseAdmin();

  // A lead should already exist from the chat flow; if a student jumps
  // straight to /apply without chatting first, create a minimal lead now.
  let { data: lead } = await supabase.from("leads").select("*").eq("session_id", sessionId).maybeSingle();
  if (!lead) {
    const { data: created } = await supabase
      .from("leads")
      .insert({ session_id: sessionId, source: "application_form", lead_status: "APPLICATION_STARTED" })
      .select()
      .single();
    lead = created;
  }
  if (!lead) {
    return NextResponse.json({ error: "Could not create or find lead for this session." }, { status: 500 });
  }

  const isSubmitting = status === "SUBMITTED";

  const payload: Record<string, unknown> = {
    lead_id: lead.id,
    program_id: programId ?? null,
    status,
    form_data: formData,
    ...(isSubmitting
      ? { submitted_at: new Date().toISOString(), application_number: generateApplicationNumber() }
      : {}),
  };

  let application;
  if (applicationId) {
    const { data, error } = await supabase
      .from("applications")
      .update(payload)
      .eq("id", applicationId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    application = data;
  } else {
    const { data, error } = await supabase.from("applications").insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    application = data;
  }

  await supabase.from("leads").update({ lead_status: isSubmitting ? "APPLICATION_SUBMITTED" : "APPLICATION_STARTED" }).eq("id", lead.id);

  await supabase.from("application_events").insert({
    application_id: application.id,
    lead_id: lead.id,
    event_type: isSubmitting ? "application_submitted" : "application_step_completed",
    metadata: { status },
  });

  if (isSubmitting) {
    notifyN8n("application_event", { application, lead });
  }

  return NextResponse.json({ application });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: lead } = await supabase.from("leads").select("id").eq("session_id", sessionId).maybeSingle();
  if (!lead) return NextResponse.json({ application: null });

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ application: application ?? null });
}
