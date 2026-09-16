import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

/**
 * Admin-only lead listing. Protected by requireAdmin (see
 * lib/admin/auth.ts) — never exposed to the public anon key / RLS path.
 */
export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const { searchParams } = req.nextUrl;

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);

  const status = searchParams.get("status");
  const score = searchParams.get("score");
  const country = searchParams.get("country");
  const program = searchParams.get("program");

  if (status) query = query.eq("lead_status", status);
  if (score) query = query.eq("lead_score", score);
  if (country) query = query.ilike("country_of_residence", `%${country}%`);
  if (program) query = query.ilike("desired_program", `%${program}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [] });
}
