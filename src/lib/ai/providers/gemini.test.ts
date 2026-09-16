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

  it("CONFIRMED BY LOCAL TEST: throws AIProviderError on a non-2xx response (rate limit / server error)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 });

    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(AIProviderError);
  });

  it("CONFIRMED BY LOCAL TEST: throws AIProviderError when the response has no usable text (e.g. safety block)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ finishReason: "SAFETY" }] }),
    });

    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(AIProviderError);
  });

  it("throws AIProviderError without calling fetch when GEMINI_API_KEY is unset", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(AIProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
