"use client";
import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client using the public anon key. Only ever reads
 * `active` knowledge_base rows and `active` programs (see RLS policies in
 * supabase/migrations/0001_init.sql) — it cannot see leads, conversations,
 * documents, or applications.
 */
import type { SupabaseAny } from "./types";

let cached: SupabaseAny | null = null;

export function getSupabaseBrowser(): SupabaseAny {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.");
  }
  cached = createClient(url, anonKey) as SupabaseAny;
  return cached;
}
