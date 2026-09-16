import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { checkProviderHealth } from "@/lib/ai/health";

export const runtime = "nodejs";

/**
 * Admin-only AI provider diagnostics. Sends one minimal request per
 * configured provider and reports reachability — never a key, header, or
 * raw upstream error. Gated by requireAdmin like every other /api/admin/*
 * route; deliberately NOT public, since hammering it would burn through
 * free-tier rate limits for no reason.
 */
export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const health = await checkProviderHealth();
  return NextResponse.json({ providers: health });
}
