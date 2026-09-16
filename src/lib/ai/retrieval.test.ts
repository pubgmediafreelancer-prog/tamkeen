import { describe, it, expect } from "vitest";
import { detectDegreeLevel, extractSearchTerms } from "./retrieval";

describe("retrieval heuristics — structured program filtering (no fuzzy-matched program invention)", () => {
  it("detects a Bachelor's-level intent in English", () => {
    expect(detectDegreeLevel("I want a bachelor's degree in cybersecurity")).toBe("BACHELOR");
  });

  it("detects a Master's-level intent in English", () => {
    expect(detectDegreeLevel("I'm looking for a master's program")).toBe("MASTER");
  });

  it("detects a Doctorate-level intent in English", () => {
    expect(detectDegreeLevel("Do you offer a PhD?")).toBe("DOCTORATE");
  });

  it("detects degree level from Arabic keywords", () => {
    expect(detectDegreeLevel("أريد دراسة الماجستير")).toBe("MASTER");
    expect(detectDegreeLevel("أريد بكالوريوس في الأمن السيبراني")).toBe("BACHELOR");
  });

  it("returns null when no degree level is mentioned", () => {
    expect(detectDegreeLevel("What is the tuition fee?")).toBeNull();
  });

  it("extracts the cybersecurity subject term from the brief's own example scenario", () => {
    expect(extractSearchTerms("I am Iraqi. I finished high school. I want to study Cybersecurity.")).toContain(
      "cybersecurity"
    );
  });

  it("extracts subject terms from Arabic", () => {
    expect(extractSearchTerms("أريد دراسة إدارة أعمال")).toContain("business administration");
  });

  it("returns an empty list when the message mentions no known subject", () => {
    expect(extractSearchTerms("Hello, how are you?")).toEqual([]);
  });
});
