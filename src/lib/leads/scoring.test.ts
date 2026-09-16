import { describe, it, expect } from "vitest";
import { scoreLead, requiresHumanFollowup } from "./scoring";

describe("scoreLead — sales prioritization only, never an admission decision", () => {
  it("scores COLD for a profile with no meaningful signal", () => {
    expect(scoreLead({})).toBe("COLD");
  });

  it("scores WARM when there's clear interest but no contact info", () => {
    expect(scoreLead({ desired_program: "Bachelor of Cybersecurity" })).toBe("WARM");
  });

  it("scores HOT when the student wants to apply and has contact info + interest", () => {
    expect(
      scoreLead({
        desired_program: "Bachelor of Cybersecurity",
        phone: "+9647701234567",
        wants_to_apply: true,
      })
    ).toBe("HOT");
  });

  it("scores HOT with contact + academic background + interest even without explicit wants_to_apply", () => {
    expect(
      scoreLead({
        email: "student@example.com",
        education_level: "High School",
        desired_level: "BACHELOR",
      })
    ).toBe("HOT");
  });
});

describe("requiresHumanFollowup", () => {
  it("flags an explicit human request", () => {
    expect(requiresHumanFollowup({ wants_human: true }, "can I talk to a human?").required).toBe(true);
  });

  it("flags a country-specific recognition question", () => {
    const result = requiresHumanFollowup({}, "Will this degree be recognized in my country?");
    expect(result.required).toBe(true);
  });

  it("flags a transfer-credit question", () => {
    expect(requiresHumanFollowup({}, "Can I transfer credit from my old university?").required).toBe(true);
  });

  it("does not flag an ordinary program question", () => {
    expect(requiresHumanFollowup({}, "What programs do you offer in IT?").required).toBe(false);
  });
});
