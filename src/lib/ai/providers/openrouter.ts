import "server-only";
import { AIGenerateParams, AIProvider, AIProviderError } from "./types";

/**
 * OpenRouter — fallback provider, used only when Gemini is unconfigured,
 * rate-limited, or erroring. OpenRouter exposes an OpenAI-compatible
 * chat-completions endpoint, called directly via fetch (no SDK).
 *
 * Free tier: OpenRouter's roster of individually `:free`-suffixed models
 * has proven to rotate significantly (e.g. the entire free Meta Llama
 * tier, including this provider's original default, disappeared in
 * August 2026). To avoid re-breaking on every rotation, the default is
 * now OpenRouter's own **Free Models Router** (`openrouter/free`) — a
 * first-party model id that OpenRouter itself resolves to whatever
 * free-tier model is currently available, at $0, with no configuration
 * upkeep required. See https://openrouter.ai/openrouter/free. You may
 * still pin a specific `:free`-suffixed model via OPENROUTER_MODEL if you
 * prefer predictable model behavior over automatic availability — verify
 * it's still listed at https://openrouter.ai/models?max_price=0 first.
 *
 * Cost protection: this provider refuses to call any model that is
 * neither the free router (`openrouter/free`) nor `:free`-suffixed,
 * unless OPENROUTER_ALLOW_PAID_MODEL=true is explicitly set — so a stale
 * or typo'd model id can never silently rack up a bill.
 */
const DEFAULT_MODEL = "openrouter/free";
const TIMEOUT_MS = 20_000;

function isFreeModel(model: string): boolean {
  return model === "openrouter/free" || model.endsWith(":free");
}

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  resolvedModel(): string {
    return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  }

  async generate({ system, messages, maxTokens = 700 }: AIGenerateParams): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new AIProviderError("OPENROUTER_API_KEY is not set", this.name, "not_configured");

    const model = this.resolvedModel();
    const allowPaid = process.env.OPENROUTER_ALLOW_PAID_MODEL === "true";
    if (!isFreeModel(model) && !allowPaid) {
      throw new AIProviderError(
        `OPENROUTER_MODEL "${model}" is not a recognized free-tier model (must be "openrouter/free" or end in ":free"). Refusing to call it to avoid unexpected cost — set OPENROUTER_MODEL to a free model, or set OPENROUTER_ALLOW_PAID_MODEL=true to override deliberately.`,
        this.name,
        "config_rejected"
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          // Recommended by OpenRouter for attribution. Falls back to a
          // placeholder rather than the real stardomuniversity.edu.eu
          // domain — this app is an admissions assistant, not the
          // university's own site, and must not misrepresent its origin.
          // Set NEXT_PUBLIC_SITE_URL to this deployment's real URL.
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://stardom-admissions-assistant.example",
          "X-Title": "Stardom University Admissions Assistant",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0.4,
          messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
        }),
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new AIProviderError(
        isAbort ? "OpenRouter request timed out" : "OpenRouter request failed",
        this.name,
        isAbort ? "timeout" : "network"
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const category =
        res.status === 401 || res.status === 403
          ? "auth"
          : res.status === 429
            ? "rate_limit"
            : res.status >= 500
              ? "server_error"
              : "unknown";
      throw new AIProviderError(`OpenRouter returned HTTP ${res.status}`, this.name, category);
    }

    const json = await res.json().catch(() => null);
    const text: string | undefined = json?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new AIProviderError("OpenRouter returned no usable text", this.name, "empty_response");
    }

    return text;
  }
}
