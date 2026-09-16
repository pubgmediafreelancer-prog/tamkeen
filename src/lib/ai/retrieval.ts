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

function detectDegreeLevel(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [kw, level] of Object.entries(DEGREE_KEYWORDS)) {
    if (lower.includes(kw)) return level;
  }
  return null;
}

function extractSearchTerms(message: string): string[] {
  const lower = message.toLowerCase();
  const terms: string[] = [];
  for (const [canonical, synonyms] of Object.entries(PROGRAM_KEYWORDS)) {
    if (synonyms.some((s) => lower.includes(s))) terms.push(canonical);
  }
  return terms;
}

/**
 * Retrieves relevant knowledge_base rows for a user message.
 * Strategy: Postgres full-text search on content, with an ILIKE fallback.
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

  if (words.length === 0) {
    const { data } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("status", "active")
      .limit(limit);
    return (data ?? []) as KnowledgeBaseRow[];
  }

  const tsQuery = words.join(" | ");
  const { data: ftsData, error: ftsError } = await supabase
    .from("knowledge_base")
    .select("*")
    .eq("status", "active")
    .textSearch("content", tsQuery, { type: "websearch", config: "english" })
    .limit(limit);

  if (!ftsError && ftsData && ftsData.length > 0) {
    return ftsData as KnowledgeBaseRow[];
  }

  const orFilter = words.map((w) => `content.ilike.%${w}%,title.ilike.%${w}%`).join(",");
  const { data: likeData } = await supabase
    .from("knowledge_base")
    .select("*")
    .eq("status", "active")
    .or(orFilter)
    .limit(limit);

  return (likeData ?? []) as KnowledgeBaseRow[];
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
