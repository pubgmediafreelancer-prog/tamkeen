import { getSupabaseAdmin } from "@/lib/supabase/server";
import { KnowledgeBaseRow, ProgramRow } from "@/lib/types";

const PROGRAM_KEYWORDS: Record<string, string[]> = {
  cybersecurity: ["cyber", "security", "hacking", "امن سيبراني", "أمن سيبراني"],
  "computer science": ["computer science", "علوم الحاسوب"],
  "software engineering": ["software", "developer", "programming", "برمجة"],
  "business administration": ["business", "management", "mba", "ادارة اعمال", "إدارة أعمال"],
  law: ["law", "legal", "قانون"],
  "artificial intelligence": ["ai", "artificial intelligence", "machine learning", "ذكاء اصطناعي"],
};

const DEGREE_KEYWORDS: Record<string, string> = {
  bachelor: "BACHELOR",
  bachelors: "BACHELOR",
  "بكالوريوس": "BACHELOR",
  undergraduate: "BACHELOR",
  master: "MASTER",
  masters: "MASTER",
  "ماجستير": "MASTER",
  graduate: "MASTER",
  phd: "DOCTORATE",
  doctorate: "DOCTORATE",
  doctoral: "DOCTORATE",
  "دكتوراه": "DOCTORATE",
  diploma: "HIGHER_DIPLOMA",
};

/** Exported for unit testing — see retrieval.test.ts. */
export function detectDegreeLevel(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [kw, level] of Object.entries(DEGREE_KEYWORDS)) {
    if (lower.includes(kw)) return level;
  }
  return null;
}

/** Exported for unit testing — see retrieval.test.ts. */
export function extractSearchTerms(message: string): string[] {
  const lower = message.toLowerCase();
  const terms: string[] = [];
  for (const [canonical, synonyms] of Object.entries(PROGRAM_KEYWORDS)) {
    if (synonyms.some((s) => lower.includes(s))) terms.push(canonical);
  }
  return terms;
}

const CORE_CATEGORIES = ["UNIVERSITY", "ADMISSIONS", "APPLICATION", "TUITION"];

/**
 * Retrieves relevant knowledge_base rows for a user message.
 * Strategy: Postgres full-text search on content, with an ILIKE fallback,
 * UNCONDITIONALLY merged with a baseline set of core university-overview
 * entries (study mode, faculties, admissions, application, tuition).
 *
 * The baseline is fetched every time — not only when the keyword searches
 * return nothing — because keyword matching against English-language
 * source content is inherently unreliable for broad questions ("what
 * programs do you have?") or non-English phrasing, and a PostgREST-level
 * query failure on the keyword step (malformed filter, tsquery edge case)
 * would otherwise silently leave the AI with zero context and force an
 * unnecessary NO_INFO_FALLBACK. Merging is cheap (few rows, deduped by id)
 * and guarantees the assistant always has basic verified facts to work
 * from, on top of whatever specific keyword matches it also finds.
 *
 * Prefer semantic (pgvector) search automatically once embeddings are
 * populated — see match_knowledge_base() in the schema — by wiring an
 * embeddings call here when EMBEDDINGS_API_KEY is configured.
 */
export async function retrieveKnowledge(
  message: string,
  limit = 6
): Promise<KnowledgeBaseRow[]> {
  const supabase = getSupabaseAdmin();

  const words = message
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8);

  const keywordMatches: KnowledgeBaseRow[] = [];

  if (words.length > 0) {
    const tsQuery = words.join(" | ");
    const { data: ftsData, error: ftsError } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("status", "active")
      .textSearch("content", tsQuery, { type: "websearch", config: "english" })
      .limit(limit);
    if (!ftsError && ftsData) keywordMatches.push(...(ftsData as KnowledgeBaseRow[]));

    if (keywordMatches.length === 0) {
      const orFilter = words.map((w) => `content.ilike.%${w}%,title.ilike.%${w}%`).join(",");
      const { data: likeData, error: likeError } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("status", "active")
        .or(orFilter)
        .limit(limit);
      if (!likeError && likeData) keywordMatches.push(...(likeData as KnowledgeBaseRow[]));
    }
  }

  const { data: coreData, error: coreError } = await supabase
    .from("knowledge_base")
    .select("*")
    .eq("status", "active")
    .in("category", CORE_CATEGORIES)
    .limit(limit);
  if (coreError) console.error("retrieveKnowledge: core baseline query failed:", coreError.message);

  const merged = new Map<string, KnowledgeBaseRow>();
  for (const row of [...keywordMatches, ...((coreData ?? []) as KnowledgeBaseRow[])]) {
    merged.set(row.id, row);
  }

  return Array.from(merged.values()).slice(0, limit);
}

/**
 * Retrieves relevant, active program records using structured filters
 * (degree level + subject keyword) rather than semantic search — program
 * facts (tuition, duration, requirements) should come from exact records,
 * never a fuzzy match.
 */
export async function retrievePrograms(message: string, limit = 5): Promise<ProgramRow[]> {
  const supabase = getSupabaseAdmin();
  const degreeLevel = detectDegreeLevel(message);
  const terms = extractSearchTerms(message);

  let query = supabase.from("programs").select("*").eq("active", true);

  if (degreeLevel) query = query.eq("degree_level", degreeLevel);

  if (terms.length > 0) {
    const orFilter = terms
      .map((t) => `program_name.ilike.%${t}%,description.ilike.%${t}%,faculty.ilike.%${t}%`)
      .join(",");
    query = query.or(orFilter);
  }

  const { data, error } = await query.limit(limit);
  if (error || !data || data.length === 0) {
    // Fall back to a broader slice so the AI has *something* grounded to
    // reference rather than nothing, still scoped to active/verified rows.
    const { data: fallback } = await supabase
      .from("programs")
      .select("*")
      .eq("active", true)
      .limit(limit);
    return (fallback ?? []) as ProgramRow[];
  }
  return data as ProgramRow[];
}
