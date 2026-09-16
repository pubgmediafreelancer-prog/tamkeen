import "server-only";
import { AIGenerateParams, AIProvider, AIProviderError } from "./types";
import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";

export type { AIMessage, AIGenerateParams } from "./types";
export { AIProviderError } from "./types";

/**
 * Ordered failover chain: Gemini (primary, free tier) → OpenRouter
 * (fallback, free tier). Never falls back to a paid model automatically —
 * see OpenRouterProvider's cost guard. Add a new provider by implementing
 * AIProvider and appending it here; nothing else in the app needs to
 * change (see docs/ARCHITECTURE.md "AI layer").
 */
const PROVIDERS: AIProvider[] = [new GeminiProvider(), new OpenRouterProvider()];

export function isAiConfigured(): boolean {
  return PROVIDERS.some((p) => p.isConfigured());
}

export function configuredProviderNames(): string[] {
  return PROVIDERS.filter((p) => p.isConfigured()).map((p) => p.name);
}

export interface AIResult {
  text: string;
  provider: string;
}

/**
 * Tries each configured provider in order. Returns null (never throws,
 * never fabricates text) if every configured provider fails or none are
 * configured — callers must show the safe human-advisor fallback in that
 * case rather than inventing an answer.
 */
export async function generateAIResponse(params: AIGenerateParams): Promise<AIResult | null> {
  const attempted: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.isConfigured()) continue;
    attempted.push(provider.name);

    try {
      const text = await provider.generate(params);
      return { text, provider: provider.name };
    } catch (err) {
      const message = err instanceof AIProviderError ? err.message : "unexpected provider error";
      // Server-side only — never includes API keys, only the provider name
      // and a generic failure reason.
      console.error(`[ai] provider "${provider.name}" failed, trying next: ${message}`);
    }
  }

  if (attempted.length === 0) {
    console.error("[ai] no AI provider is configured (set GEMINI_API_KEY and/or OPENROUTER_API_KEY)");
  } else {
    console.error(`[ai] all configured providers failed: ${attempted.join(" -> ")}`);
  }
  return null;
}
