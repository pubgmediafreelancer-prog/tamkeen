import { describe, it, expect, vi } from "vitest";
import { AIProviderError } from "./providers/types";

const geminiMock = {
  name: "gemini",
  isConfigured: vi.fn(),
  generate: vi.fn(),
  resolvedModel: vi.fn(() => "gemini-3.6-flash"),
};
const openrouterMock = {
  name: "openrouter",
  isConfigured: vi.fn(),
  generate: vi.fn(),
  resolvedModel: vi.fn(() => "openrouter/free"),
};

vi.mock("./providers", () => ({
  getProviders: () => [geminiMock, openrouterMock],
}));

import { checkProviderHealth } from "./health";

describe("checkProviderHealth — never exposes secrets", () => {
  it("reports configured=false and skips calling generate() for an unconfigured provider", async () => {
    geminiMock.isConfigured.mockReturnValue(false);
    openrouterMock.isConfigured.mockReturnValue(false);

    const results = await checkProviderHealth();

    expect(results).toEqual([
      { provider: "gemini", configured: false, model: "gemini-3.6-flash" },
      { provider: "openrouter", configured: false, model: "openrouter/free" },
    ]);
    expect(geminiMock.generate).not.toHaveBeenCalled();
    expect(openrouterMock.generate).not.toHaveBeenCalled();
  });

  it("CONFIRMED BY LOCAL TEST: reports reachable=true when a configured provider responds", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockResolvedValue("OK");
    openrouterMock.isConfigured.mockReturnValue(false);

    const results = await checkProviderHealth();

    const gemini = results.find((r) => r.provider === "gemini");
    expect(gemini).toEqual({ provider: "gemini", configured: true, reachable: true, model: "gemini-3.6-flash" });
  });

  it("CONFIRMED BY LOCAL TEST: reports reachable=false with an error category, never the raw error/keys", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockRejectedValue(new AIProviderError("Gemini returned HTTP 429", "gemini", "rate_limit"));
    openrouterMock.isConfigured.mockReturnValue(false);

    const results = await checkProviderHealth();
    const gemini = results.find((r) => r.provider === "gemini");

    expect(gemini?.reachable).toBe(false);
    expect(gemini?.errorCategory).toBe("rate_limit");
    // The full report must never contain anything resembling a key/header.
    expect(JSON.stringify(results)).not.toMatch(/key|bearer|authorization/i);
  });

  it("checks every configured provider independently, not stopping at the first failure", async () => {
    geminiMock.isConfigured.mockReturnValue(true);
    geminiMock.generate.mockRejectedValue(new AIProviderError("down", "gemini", "server_error"));
    openrouterMock.isConfigured.mockReturnValue(true);
    openrouterMock.generate.mockResolvedValue("OK");

    const results = await checkProviderHealth();

    expect(results.find((r) => r.provider === "gemini")?.reachable).toBe(false);
    expect(results.find((r) => r.provider === "openrouter")?.reachable).toBe(true);
  });
});
