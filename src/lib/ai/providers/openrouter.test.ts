import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenRouterProvider } from "./openrouter";
import { AIProviderError } from "./types";

describe("OpenRouterProvider", () => {
  const provider = new OpenRouterProvider();

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is not configured without OPENROUTER_API_KEY", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(provider.isConfigured()).toBe(false);
  });

  it("CONFIRMED BY LOCAL TEST: returns the model's text on a successful response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Hello from OpenRouter" } }] }),
    });

    const text = await provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] });
    expect(text).toBe("Hello from OpenRouter");
  });

  it("CONFIRMED BY LOCAL TEST: throws AIProviderError on a non-2xx response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });

    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(AIProviderError);
  });

  it("COST PROTECTION: refuses to call a non-free model by default (never fetches)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o"); // a paid model, deliberately not ":free"
    vi.stubEnv("OPENROUTER_ALLOW_PAID_MODEL", "");

    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(AIProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("COST PROTECTION: allows a non-free model only when OPENROUTER_ALLOW_PAID_MODEL=true", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o");
    vi.stubEnv("OPENROUTER_ALLOW_PAID_MODEL", "true");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).resolves.toBe("ok");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("defaults to a ':free'-suffixed model when OPENROUTER_MODEL is unset", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    await provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] });
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.model.endsWith(":free")).toBe(true);
  });
});
