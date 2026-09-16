import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock() factories are hoisted above regular top-level statements, so
// the mock instances they close over must be created via vi.hoisted() to
// avoid a temporal-dead-zone reference error.
const { geminiMock, openrouterMock } = vi.hoisted(() => ({
  geminiMock: { isConfigured: vi.fn(), generate: vi.fn(), name: "gemini" },
  openrouterMock: { isConfigured: vi.fn(), generate: vi.fn(), name: "openrouter" },
}));

vi.mock("./gemini", () => ({
  GeminiProvider: vi.fn(function GeminiProvider() {
    return geminiMock;
  }),
}));
vi.mock("./openrouter", () => ({
  OpenRouterProvider: vi.fn(function OpenRouterProvider() {
    return openrouterMock;
  }),
}));

import { generateAIResponse, isAiConfigured } from "./index";
import { AIProviderError } from "./types";

describe("AI service — provider failover (Gemini -> OpenRouter -> null)", () => {
  beforeEach(() => {
    geminiMock.isConfigured.mockReset();
    geminiMock.generate.mockReset();
    openrouterMock.isConfigured.mockReset();
    openrouterMock.generate.mockReset();
  });

  it("CONFIRMED BY LOCAL TEST: uses Gemini's response when it succeeds, never calling OpenRouter", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockResolvedValue("gemini reply");
    openrouterMock.isConfigured.mockReturnValue(true);

    const result = await generateAIResponse({ system: "s", messages: [] });

    expect(result).toEqual({ text: "gemini reply", provider: "gemini" });
    expect(openrouterMock.generate).not.toHaveBeenCalled();
  });

  it("CONFIRMED BY LOCAL TEST: fails over to OpenRouter when Gemini throws (rate limit / timeout / error)", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockRejectedValue(new AIProviderError("rate limited", "gemini"));
    openrouterMock.isConfigured.mockReturnValue(true);
    openrouterMock.generate.mockResolvedValue("openrouter reply");

    const result = await generateAIResponse({ system: "s", messages: [] });

    expect(result).toEqual({ text: "openrouter reply", provider: "openrouter" });
  });

  it("CONFIRMED BY LOCAL TEST: returns null (never fabricates an answer) when every configured provider fails", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockRejectedValue(new AIProviderError("down", "gemini"));
    openrouterMock.isConfigured.mockReturnValue(true);
    openrouterMock.generate.mockRejectedValue(new AIProviderError("down", "openrouter"));

    const result = await generateAIResponse({ system: "s", messages: [] });

    expect(result).toBeNull();
  });

  it("CONFIRMED BY LOCAL TEST: returns null without calling either provider when neither is configured", async () => {
    geminiMock.isConfigured.mockReturnValue(false);
    openrouterMock.isConfigured.mockReturnValue(false);

    const result = await generateAIResponse({ system: "s", messages: [] });

    expect(result).toBeNull();
    expect(geminiMock.generate).not.toHaveBeenCalled();
    expect(openrouterMock.generate).not.toHaveBeenCalled();
  });

  it("skips OpenRouter's generate() when only Gemini is configured and succeeds", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockResolvedValue("ok");
    openrouterMock.isConfigured.mockReturnValue(false);

    await generateAIResponse({ system: "s", messages: [] });

    expect(openrouterMock.generate).not.toHaveBeenCalled();
  });

  it("isAiConfigured() reflects whether any provider is configured", () => {
    geminiMock.isConfigured.mockReturnValue(false);
    openrouterMock.isConfigured.mockReturnValue(true);
    expect(isAiConfigured()).toBe(true);

    geminiMock.isConfigured.mockReturnValue(false);
    openrouterMock.isConfigured.mockReturnValue(false);
    expect(isAiConfigured()).toBe(false);
  });
});
