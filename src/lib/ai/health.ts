import "server-only";
import { getProviders } from "./providers";
import { AIProviderError, AIErrorCategory } from "./providers/types";

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  /** Undefined when `configured` is false — no call is made in that case. */
  reachable?: boolean;
  model: string;
  errorCategory?: AIErrorCategory;
}

const HEALTH_CHECK_SYSTEM =
  "You are a health check. Reply with exactly one word: OK. Do not add punctuation or explanation.";
const HEALTH_CHECK_MESSAGE = "ping";
const HEALTH_CHECK_MAX_TOKENS = 8; // minimal — this call is billed against free-tier quota, keep it cheap

/**
 * Exercises each configured AI provider with one minimal request and
 * reports whether it's actually reachable — separately from the
 * generateAIResponse() failover path, which only tells you which
 * provider answered a given chat turn, not the state of a provider that
 * happened not to be needed.
 *
 * SECURITY: never returns an API key, an Authorization/x-goog-api-key
 * header, or a raw upstream error body — only a coarse AIErrorCategory
 * and a short, generic message. Intended to be called from a
 * server-only context (a script, or an already-authenticated admin
 * route via lib/admin/auth.ts) — never expose this as a public,
 * unauthenticated endpoint, since repeated calls would burn through
 * free-tier rate limits.
 */
export async function checkProviderHealth(): Promise<ProviderHealth[]> {
  const results: ProviderHealth[] = [];

  for (const provider of getProviders()) {
    const model = provider.resolvedModel();

    if (!provider.isConfigured()) {
      results.push({ provider: provider.name, configured: false, model });
      continue;
    }

    try {
      await provider.generate({
        system: HEALTH_CHECK_SYSTEM,
        messages: [{ role: "user", content: HEALTH_CHECK_MESSAGE }],
        maxTokens: HEALTH_CHECK_MAX_TOKENS,
      });
      results.push({ provider: provider.name, configured: true, reachable: true, model });
    } catch (err) {
      const category = err instanceof AIProviderError ? err.category : "unknown";
      results.push({ provider: provider.name, configured: true, reachable: false, model, errorCategory: category });
    }
  }

  return results;
}
