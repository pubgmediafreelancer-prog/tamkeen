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

  it("throws a not_configured error without calling fetch when OPENROUTER_API_KEY is unset", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("not_configured");
    expect(global.fetch).not.toHaveBeenCalled();
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

  it("CONFIRMED BY LOCAL TEST: categorizes a 429 as rate_limit", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 });

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("rate_limit");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes a 401 as auth and a 503 as server_error", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401 });
    const authErr: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(authErr.category).toBe("auth");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 503 });
    const serverErr: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(serverErr.category).toBe("server_error");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes a fetch abort as timeout", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err.category).toBe("timeout");
  });

  it("CONFIRMED BY LOCAL TEST: categorizes an empty/missing choices response as empty_response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err.category).toBe("empty_response");
  });

  it("COST PROTECTION: refuses to call a non-free model by default (never fetches)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o"); // a paid model, deliberately not free
    vi.stubEnv("OPENROUTER_ALLOW_PAID_MODEL", "");

    const err: AIProviderError = await provider
      .generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.category).toBe("config_rejected");
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

  it("COST PROTECTION: accepts a ':free'-suffixed pinned model", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "some-vendor/some-model:free");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    await expect(
      provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    ).resolves.toBe("ok");
  });

  it('defaults to OpenRouter\'s self-updating "openrouter/free" router when OPENROUTER_MODEL is unset', () => {
    vi.stubEnv("OPENROUTER_MODEL", "");
    expect(provider.resolvedModel()).toBe("openrouter/free");
  });

  it("COST PROTECTION: accepts the default 'openrouter/free' router without requiring OPENROUTER_ALLOW_PAID_MODEL", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    await provider.generate({ system: "sys", messages: [{ role: "user", content: "hi" }] });
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("openrouter/free");
  });
});
