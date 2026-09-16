import "server-only";
import { AIGenerateParams, AIProvider, AIProviderError } from "./types";

/**
 * OpenRouter — fallback provider, used only when Gemini is unconfigured,
 * rate-limited, or erroring. OpenRouter exposes an OpenAI-compatible
 * chat-completions endpoint, called directly via fetch (no SDK).
 *
 * Free tier: OpenRouter's roster of `:free`-suffixed models changes over
 * time (see https://openrouter.ai/models?max_price=0). GEMINI/OPENROUTER
 * model IDs are never hardcoded into request logic — only this default,
 * which you should re-verify periodically. Cost protection: this provider
 * refuses to call a model that doesn't look like a free-tier model (no
 * `:free` suffix) unless OPENROUTER_ALLOW_PAID_MODEL=true is explicitly
 * set, so a stale/typo'd model id can never silently rack up a bill.
 */
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const TIMEOUT_MS = 20_000;

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  private model(): string {
    return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  }

  async generate({ system, messages, maxTokens = 700 }: AIGenerateParams): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new AIProviderError("OPENROUTER_API_KEY is not set", this.name);

    const model = this.model();
    const allowPaid = process.env.OPENROUTER_ALLOW_PAID_MODEL === "true";
    if (!model.endsWith(":free") && !allowPaid) {
      throw new AIProviderError(
        `OPENROUTER_MODEL "${model}" is not a recognized free-tier model (no ":free" suffix). Refusing to call it to avoid unexpected cost — set OPENROUTER_MODEL to a free model, or set OPENROUTER_ALLOW_PAID_MODEL=true to override deliberately.`,
        this.name
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
          // Required/recommended by OpenRouter for free-tier attribution.
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://stardomuniversity.edu.eu",
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
      throw new AIProviderError(isAbort ? "OpenRouter request timed out" : "OpenRouter request failed", this.name);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new AIProviderError(`OpenRouter returned HTTP ${res.status}`, this.name);
    }

    const json = await res.json().catch(() => null);
    const text: string | undefined = json?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new AIProviderError("OpenRouter returned no usable text", this.name);
    }

    return text;
  }
}
