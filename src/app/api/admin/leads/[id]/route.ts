import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const [{ data: lead, error: leadError }, { data: conversations }, { data: applications }, { data: documents }] =
    await Promise.all([
      supabase.from("leads").select("*").eq("id", id).maybeSingle(),
      supabase.from("conversations").select("*").eq("lead_id", id).order("created_at", { ascending: true }),
      supabase.from("applications").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("lead_id", id).order("uploaded_at", { ascending: false }),
    ]);

  if (leadError || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({
    lead,
    conversations: conversations ?? [],
    applications: applications ?? [],
    documents: documents ?? [],
  });
}
