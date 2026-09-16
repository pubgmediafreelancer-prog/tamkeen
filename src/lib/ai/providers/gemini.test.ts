import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiProvider } from "./gemini";
import { AIProviderError } from "./types";

describe("GeminiProvider", () => {
  const provider = new GeminiProvider();

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is not configured without GEMINI_API_KEY", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(provider.isConfigured()).toBe(false);
  });

  it("is configured once GEMINI_API_KEY is set", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    expect(provider.isConfigured()).toBe(true);
  });

  it("LIVE-VERIFIED: defaults to gemini-3.6-flash — confirmed by a real API call (Sept 2026) after gemini-2.5-flash returned a live HTTP 404 telling us to migrate to it", () => {
    vi.stubEnv("GEMINI_MODEL", "");
    expect(provider.resolvedModel()).toBe("gemini-3.6-flash");
  });

  it("disables thinking (thinkingBudget: 0) so maxOutputTokens isn't consumed by an invisible reasoning trace — confirmed live to fix truncated/empty output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    });

    await provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] });

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("throws a not_configured error without calling fetch when GEMINI_API_KEY is unset", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("not_configured");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("CONFIRMED BY LOCAL TEST: returns the model's text on a successful response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] }, finishReason: "STOP" }],
      }),
    });

    const text = await provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] });
    expect(text).toBe("Hello from Gemini");
  });

  it("SECURITY: authenticates via the x-goog-api-key header, never a ?key= query param", async () => {
    vi.stubEnv("GEMINI_API_KEY", "super-secret-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    });

    await provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] });

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("super-secret-key");
    expect(options.headers["x-goog-api-key"]).toBe("super-secret-key");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes a 429 as rate_limit", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 });

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("rate_limit");
  });

  it("LIVE-VERIFIED: categorizes a 404 as model_not_found — this is the exact response Google returns for a retired model id", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("model_not_found");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes a 403 as auth and a 500 as server_error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 403 });
    const authErr: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(authErr.category).toBe("auth");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 });
    const serverErr: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(serverErr.category).toBe("server_error");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes a fetch abort as timeout", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err.category).toBe("timeout");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes a safety-blocked/empty candidate as empty_response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ finishReason: "SAFETY" }] }),
    });

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("empty_response");
  });
});
