/**
 * Loads the hand-verified seed data (data/knowledge-base-seed.json,
 * data/programs-seed.json) into Supabase. This is the fastest path to a
 * working demo without waiting on a live crawl.
 *
 * Usage: npx tsx scripts/seed.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import knowledgeBase from "../data/knowledge-base-seed.json";
import programs from "../data/programs-seed.json";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables.");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`Seeding ${knowledgeBase.length} knowledge_base entries...`);
  const { error: kbError } = await supabase
    .from("knowledge_base")
    .upsert(knowledgeBase, { onConflict: "source_url,title" });
  if (kbError) {
    console.error("knowledge_base seed failed:", kbError.message);
    process.exit(1);
  }

  console.log(`Seeding ${programs.length} programs...`);
  const { error: programsError } = await supabase
    .from("programs")
    .upsert(programs, { onConflict: "program_name,degree_level" });
  if (programsError) {
    console.error("programs seed failed:", programsError.message);
    process.exit(1);
  }

  console.log("Seed complete.");
}

main();
