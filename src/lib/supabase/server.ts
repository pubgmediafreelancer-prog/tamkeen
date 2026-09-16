import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseAny } from "./types";

/**
 * Server-only Supabase client using the service role key. Never import
 * this from a Client Component — the `server-only` import above makes the
 * build fail if you try.
 */
let cached: SupabaseAny | null = null;

export function getSupabaseAdmin(): SupabaseAny {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment (see .env.example)."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false },
  }) as SupabaseAny;
  return cached;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
