import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * MVP admin auth: a shared secret passed as `x-admin-token` (or
 * `?token=` for simple browser navigation), checked against ADMIN_TOKEN.
 *
 * This is intentionally minimal for the MVP. Before real launch, replace
 * with Supabase Auth + the `admins can manage *` RLS policies already
 * defined in supabase/migrations/0001_init.sql (role stored in
 * app_metadata.role = 'admin'), so admin dashboard access is tied to a
 * real login rather than a shared token.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured. Set it in your environment to enable the admin dashboard." },
      { status: 500 }
    );
  }

  const header = req.headers.get("x-admin-token");
  const query = req.nextUrl.searchParams.get("token");
  const provided = header || query;

  if (provided !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
