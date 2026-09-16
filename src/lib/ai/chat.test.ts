import { describe, it, expect, vi, beforeEach } from "vitest";
import { PROVIDER_UNAVAILABLE_FALLBACK } from "./system-prompt";

const generateAIResponseMock = vi.fn();

vi.mock("./providers", () => ({
  generateAIResponse: (...args: unknown[]) => generateAIResponseMock(...args),
  isAiConfigured: vi.fn(() => true),
  configuredProviderNames: vi.fn(() => ["gemini"]),
}));

import { generateChatTurn } from "./chat";

describe("generateChatTurn — single-call reply + profile extraction", () => {
  beforeEach(() => {
    generateAIResponseMock.mockReset();
  });

  it("CONFIRMED BY LOCAL TEST: parses <reply> and <profile_update> tags from a well-formed response", async () => {
    generateAIResponseMock.mockResolvedValue({
      provider: "gemini",
      text: `<reply>\nHi! Cybersecurity is a great choice.\n</reply>\n<profile_update>\n{"desired_program": "Bachelor of Cybersecurity", "desired_level": "BACHELOR"}\n</profile_update>`,
    });

    const result = await generateChatTurn(
      [{ role: "user", content: "I want to study cybersecurity" }],
      [],
      [],
      {}
    );

    expect(result.reply).toBe("Hi! Cybersecurity is a great choice.");
    expect(result.extracted).toEqual({ desired_program: "Bachelor of Cybersecurity", desired_level: "BACHELOR" });
    expect(result.provider).toBe("gemini");
    expect(result.providerFailure).toBe(false);
  });

  it("CONFIRMED BY LOCAL TEST: falls back to using the raw text as the reply when tags are missing (never shows nothing)", async () => {
    generateAIResponseMock.mockResolvedValue({
      provider: "openrouter",
      text: "Sure, here is some information about cybersecurity at Stardom.",
    });

    const result = await generateChatTurn([{ role: "user", content: "tell me more" }], [], [], {});

    expect(result.reply).toBe("Sure, here is some information about cybersecurity at Stardom.");
    expect(result.extracted).toEqual({});
  });

  it("CONFIRMED BY LOCAL TEST: falls back gracefully when <profile_update> contains invalid JSON", async () => {
    generateAIResponseMock.mockResolvedValue({
      provider: "gemini",
      text: `<reply>Okay.</reply>\n<profile_update>{not valid json}</profile_update>`,
    });

    const result = await generateChatTurn([{ role: "user", content: "hi" }], [], [], {});

    expect(result.reply).toBe("Okay.");
    expect(result.extracted).toEqual({});
  });

  it("SAFE FALLBACK: never fabricates an answer — returns the fixed fallback sentence and flags providerFailure when every provider fails", async () => {
    generateAIResponseMock.mockResolvedValue(null);

    const result = await generateChatTurn([{ role: "user", content: "what is the tuition" }], [], [], {});

    expect(result.reply).toBe(PROVIDER_UNAVAILABLE_FALLBACK);
    expect(result.provider).toBeNull();
    expect(result.providerFailure).toBe(true);
    expect(result.extracted).toEqual({});
  });
});
