import "server-only";
import { generateAIResponse, isAiConfigured, configuredProviderNames } from "./providers";
import { BASE_SYSTEM_PROMPT, buildContextBlock, PROVIDER_UNAVAILABLE_FALLBACK } from "./system-prompt";
import { KnowledgeBaseRow, ProgramRow, StudentProfile } from "@/lib/types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export { isAiConfigured, configuredProviderNames };

export interface ChatTurnResult {
  reply: string;
  extracted: Partial<StudentProfile>;
  /** Provider that produced this reply, or null if every provider failed. */
  provider: string | null;
  /** True when both/all configured providers failed and we returned the safe fallback. */
  providerFailure: boolean;
}

/**
 * Parses the model's required <reply>/<profile_update> tagged output.
 * Deliberately tolerant of a model that doesn't follow the format
 * perfectly (small free-tier models sometimes drift) — the student must
 * never see raw JSON or an empty message because of a formatting slip.
 */
function parseTaggedResponse(raw: string): { reply: string; extracted: Partial<StudentProfile> } {
  const replyMatch = raw.match(/<reply>([\s\S]*?)<\/reply>/i);
  const profileMatch = raw.match(/<profile_update>([\s\S]*?)<\/profile_update>/i);

  let reply = replyMatch ? replyMatch[1].trim() : raw.replace(/<profile_update>[\s\S]*?<\/profile_update>/gi, "").trim();
  reply = reply.replace(/<\/?reply>/gi, "").trim();
  if (!reply) reply = raw.trim();

  let extracted: Partial<StudentProfile> = {};
  if (profileMatch) {
    try {
      const parsed = JSON.parse(profileMatch[1].trim());
      if (parsed && typeof parsed === "object") extracted = parsed;
    } catch {
      extracted = {};
    }
  }
  return { reply, extracted };
}

/**
 * Single provider-agnostic call per chat turn: generates the student-facing
 * reply AND extracts new profile facts in one round trip (see the
 * OUTPUT FORMAT section of BASE_SYSTEM_PROMPT) — deliberately avoiding a
 * second AI call, since free-tier rate limits are the binding constraint
 * for this MVP (see docs/ARCHITECTURE.md "Cost protection").
 *
 * Never fabricates an answer: if every configured provider fails, returns
 * PROVIDER_UNAVAILABLE_FALLBACK with providerFailure=true so the caller can
 * force a human-follow-up flag on the lead.
 */
export async function generateChatTurn(
  history: ChatTurn[],
  knowledge: KnowledgeBaseRow[],
  programs: ProgramRow[],
  profile: StudentProfile
): Promise<ChatTurnResult> {
  const contextBlock = buildContextBlock(knowledge, programs, profile);
  const system = `${BASE_SYSTEM_PROMPT}\n\n${contextBlock}`;

  const result = await generateAIResponse({
    system,
    messages: history,
    maxTokens: 900,
  });

  if (!result) {
    return { reply: PROVIDER_UNAVAILABLE_FALLBACK, extracted: {}, provider: null, providerFailure: true };
  }

  const { reply, extracted } = parseTaggedResponse(result.text);
  return { reply, extracted, provider: result.provider, providerFailure: false };
}
