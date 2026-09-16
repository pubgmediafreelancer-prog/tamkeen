import "server-only";
import { AIGenerateParams, AIProvider, AIProviderError } from "./types";

/**
 * Google Gemini API (REST) — primary provider. Uses the official
 * generativelanguage.googleapis.com REST endpoint directly (no SDK
 * dependency) so the app stays lightweight and never assumes a specific
 * SDK's billing/retry defaults.
 *
 * Free tier: as of this build, Gemini's free tier covers models like
 * `gemini-2.0-flash` / `gemini-flash-latest` at no cost within published
 * rate limits. Google renames/retires free-tier models over time, so the
 * model is NOT hardcoded — set GEMINI_MODEL to whatever is currently free
 * at https://ai.google.dev/gemini-api/docs/pricing. This code only ever
 * calls the exact model you configure; it never upgrades itself.
 */
const DEFAULT_MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 20_000;

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private model(): string {
    return process.env.GEMINI_MODEL || DEFAULT_MODEL;
  }

  async generate({ system, messages, maxTokens = 700 }: AIGenerateParams): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIProviderError("GEMINI_API_KEY is not set", this.name);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model()}:generateContent?key=${apiKey}`;

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
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
        }),
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new AIProviderError(isAbort ? "Gemini request timed out" : "Gemini request failed", this.name);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      // 429 = rate limit, 5xx = server error, 400/403 = bad key/model config
      // — all of these should fail over to the next provider rather than
      // surface a raw error to the student.
      throw new AIProviderError(`Gemini returned HTTP ${res.status}`, this.name);
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
        this.name
      );
    }

    return text;
  }
}
