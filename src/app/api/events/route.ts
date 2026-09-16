import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EventSchema = z.object({
  sessionId: z.string().min(8).optional(),
  eventType: z.enum([
    "page_view",
    "chat_started",
    "question_asked",
    "program_viewed",
    "lead_created",
    "lead_qualified",
    "application_started",
    "application_completed",
    "document_uploaded",
    "application_submitted",
    "enrollment_confirmed",
  ]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/** Lightweight funnel analytics sink — see docs/ARCHITECTURE.md "Analytics". */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 200 });

  const body = await req.json().catch(() => null);
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = getSupabaseAdmin();
  let leadId: string | null = null;
  if (parsed.data.sessionId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("session_id", parsed.data.sessionId)
      .maybeSingle();
    leadId = lead?.id ?? null;
  }

  await supabase.from("application_events").insert({
    lead_id: leadId,
    event_type: parsed.data.eventType,
    metadata: parsed.data.metadata,
  });

  return NextResponse.json({ ok: true });
}
