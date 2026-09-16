import "server-only";
import { AIGenerateParams, AIProvider, AIProviderError } from "./types";

/**
 * Google Gemini API (REST) — primary provider. Uses the official
 * generativelanguage.googleapis.com REST endpoint directly (no SDK
 * dependency) so the app stays lightweight and never assumes a specific
 * SDK's billing/retry defaults.
 *
 * Free tier: `gemini-2.5-flash` is the current (Sept 2026) free-tier
 * default — verified against Gemini API release notes and third-party
 * rate-limit trackers at the time of this change. `gemini-2.0-flash`
 * (the previous default) was retired/shut down on June 1, 2026 and now
 * returns errors, so it is no longer usable as a default. Free-tier
 * models are renamed/retired by Google over time, so the model is NEVER
 * hardcoded into the request logic — set GEMINI_MODEL to whatever is
 * currently free at https://ai.google.dev/gemini-api/docs/pricing before
 * relying on this default in production. This code only ever calls the
 * exact model you configure; it never upgrades itself.
 */
const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20_000;

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  resolvedModel(): string {
    return process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async generate({ system, messages, maxTokens = 700 }: AIGenerateParams): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIProviderError("GEMINI_API_KEY is not set", this.name, "not_configured");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.resolvedModel()}:generateContent`;

    // Gemini uses "model" (not "assistant") for the assistant turn.
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header-based auth (current Gemini API standard) instead of the
          // legacy `?key=` query param, so the key never ends up in a URL
          // that some proxy/CDN/error-tracker might log verbatim.
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
        }),
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new AIProviderError(
        isAbort ? "Gemini request timed out" : "Gemini request failed",
        this.name,
        isAbort ? "timeout" : "network"
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      // 401/403 = bad/missing key, 404 = bad model id, 429 = rate limit,
      // 5xx = server error — all of these fail over to the next provider
      // rather than surface a raw error to the student.
      const category =
        res.status === 401 || res.status === 403
          ? "auth"
          : res.status === 429
            ? "rate_limit"
            : res.status >= 500
              ? "server_error"
              : "unknown";
      throw new AIProviderError(`Gemini returned HTTP ${res.status}`, this.name, category);
    }

    const json = await res.json().catch(() => null);
    const candidate = json?.candidates?.[0];

    // A candidate blocked by safety filters or otherwise missing content
    // counts as a failure for our purposes — fail over rather than show
    // the student nothing.
    const text: string | undefined = candidate?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new AIProviderError(
        `Gemini returned no usable text (finishReason: ${candidate?.finishReason ?? "unknown"})`,
        this.name,
        "empty_response"
      );
    }

    return text;
  }
}
