import type { SupabaseClient } from "@supabase/supabase-js";

// No generated `Database` type is wired up yet (see docs/ARCHITECTURE.md);
// `any` keeps table access ergonomic until `supabase gen types` is run
// against a real project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAny = SupabaseClient<any, any, any>;
