import "server-only";
import { AIGenerateParams, AIProvider, AIProviderError } from "./types";

/**
 * Google Gemini API (REST) — primary provider. Uses the official
 * generativelanguage.googleapis.com REST endpoint directly (no SDK
 * dependency) so the app stays lightweight and never assumes a specific
 * SDK's billing/retry defaults.
 *
 * Free tier: `gemini-3.6-flash` is the current default, confirmed by a
 * LIVE call against the real Gemini API with a real key (Sept 2026) — the
 * previous default, `gemini-2.5-flash`, now returns HTTP 404 with the
 * message "This model ... is no longer available to new users. Please
 * update your code to use models/gemini-3.6-flash", which is itself
 * confirmation of exactly the kind of rename/retirement this design
 * anticipates (and `gemini-2.0-flash`, the original default before that,
 * was shut down entirely on June 1, 2026). Free-tier models are
 * renamed/retired by Google over time, so the model is NEVER hardcoded
 * into the request logic — set GEMINI_MODEL to whatever is currently free
 * at https://ai.google.dev/gemini-api/docs/pricing before relying on this
 * default in production. This code only ever calls the exact model you
 * configure; it never upgrades itself.
 */
const DEFAULT_MODEL = "gemini-3.6-flash";
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
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.4,
            // gemini-3.6-flash "thinks" by default, spending part of
            // maxOutputTokens on an invisible reasoning trace before any
            // visible text — confirmed live to consume most/all of a
            // small budget and truncate output entirely (finishReason
            // MAX_TOKENS with empty text). This app needs deterministic,
            // tagged (<reply>/<profile_update>) output, not open-ended
            // reasoning, so thinking is disabled outright — verified live
            // to fix truncation and avoid burning free-tier quota on
            // invisible tokens.
            thinkingConfig: { thinkingBudget: 0 },
          },
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
      // 401/403 = bad/missing key, 404 = retired/unknown model id (Google
      // returns this — confirmed live — when GEMINI_MODEL names a model
      // no longer available to this key, e.g. a retired free-tier model),
      // 429 = rate limit, 5xx = server error — all of these fail over to
      // the next provider rather than surface a raw error to the student.
      const category =
        res.status === 401 || res.status === 403
          ? "auth"
          : res.status === 404
            ? "model_not_found"
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
