/**
 * Provider-agnostic AI abstraction. The rest of the app (system prompt,
 * retrieval, chat route) talks to `AIProvider` only — never to a specific
 * vendor SDK/API directly — so a provider can be swapped or added without
 * touching application logic. See docs/ARCHITECTURE.md "AI layer".
 */

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIGenerateParams {
  /** System prompt, including the verified-context block for this turn. */
  system: string;
  messages: AIMessage[];
  maxTokens?: number;
}

/**
 * Thrown by a provider on any failure that should trigger failover to the
 * next configured provider (rate limit, timeout, 5xx, malformed/empty
 * response). Providers should throw this rather than let raw fetch/SDK
 * errors escape, so the AIService can log consistently and never leak
 * secrets in the message.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export interface AIProvider {
  /** Short identifier used in logs and the `provider` field on responses. */
  readonly name: string;
  /** True when this provider has the env vars it needs to be called. */
  isConfigured(): boolean;
  /** Returns the raw text completion. Throws AIProviderError on any failure. */
  generate(params: AIGenerateParams): Promise<string>;
}
