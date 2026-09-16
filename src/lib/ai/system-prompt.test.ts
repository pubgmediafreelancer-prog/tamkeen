import { describe, it, expect } from "vitest";
import { BASE_SYSTEM_PROMPT, NO_INFO_FALLBACK, PROVIDER_UNAVAILABLE_FALLBACK, buildContextBlock } from "./system-prompt";
import { KnowledgeBaseRow, ProgramRow } from "@/lib/types";

describe("system prompt — no-hallucination / safety contract", () => {
  it("embeds the exact NO_INFO_FALLBACK sentence, not a paraphrase", () => {
    expect(BASE_SYSTEM_PROMPT).toContain(NO_INFO_FALLBACK);
  });

  it("explicitly forbids inventing every category listed in the brief", () => {
    const mustMention = [
      "tuition",
      "scholarships",
      "accreditation",
      "recognition",
      "visa",
      "transfer-credit",
      "admission",
    ];
    for (const term of mustMention) {
      expect(BASE_SYSTEM_PROMPT.toLowerCase()).toContain(term);
    }
  });

  it("forbids definitive admission-decision language", () => {
    expect(BASE_SYSTEM_PROMPT).toMatch(/never say.*accepted/i);
    expect(BASE_SYSTEM_PROMPT).toContain("guaranteed admission");
  });

  it("requires the tagged <reply>/<profile_update> output format used by chat.ts's parser", () => {
    expect(BASE_SYSTEM_PROMPT).toContain("<reply>");
    expect(BASE_SYSTEM_PROMPT).toContain("<profile_update>");
  });

  it("instructs automatic Arabic/English language detection", () => {
    expect(BASE_SYSTEM_PROMPT.toLowerCase()).toContain("arabic");
    expect(BASE_SYSTEM_PROMPT.toLowerCase()).toContain("automatically");
  });

  it("instructs progressive lead collection, not a front-loaded form", () => {
    expect(BASE_SYSTEM_PROMPT.toLowerCase()).toContain("progressively");
  });

  it("PROVIDER_UNAVAILABLE_FALLBACK points to a human advisor and never claims an answer", () => {
    expect(PROVIDER_UNAVAILABLE_FALLBACK.toLowerCase()).toContain("advisor");
  });
});

describe("buildContextBlock — retrieval grounding", () => {
  const knowledge: KnowledgeBaseRow[] = [
    {
      id: "k1",
      title: "Tuition fee structure",
      category: "TUITION",
      content: "USD 600 per semester.",
      source_url: "https://stardomuniversity.edu.eu/tuition-fees/",
      source_title: "Tuition Fees",
      language: "en",
      last_verified: "2026-09-16",
      status: "active",
    },
  ];
  const programs: ProgramRow[] = [
    {
      id: "p1",
      program_name: "Bachelor of Cybersecurity",
      degree_level: "BACHELOR",
      faculty: "Faculty of IT and Computing",
      school: null,
      description: null,
      duration: null,
      study_mode: "Online",
      language: "English",
      tuition: "USD 600 per semester",
      application_fee: null,
      requirements: null,
      documents_required: null,
      scholarship_information: null,
      source_url: "https://stardomuniversity.edu.eu/academic-programs/faculty-of-it-and-cs/",
      last_verified: "2026-09-16",
      active: true,
    },
  ];

  it("includes retrieved knowledge with its source_url", () => {
    const block = buildContextBlock(knowledge, [], {});
    expect(block).toContain("Tuition fee structure");
    expect(block).toContain("https://stardomuniversity.edu.eu/tuition-fees/");
  });

  it("includes retrieved programs with source_url and last_verified", () => {
    const block = buildContextBlock([], programs, {});
    expect(block).toContain("Bachelor of Cybersecurity");
    expect(block).toContain("https://stardomuniversity.edu.eu/academic-programs/faculty-of-it-and-cs/");
    expect(block).toContain("verified 2026-09-16");
  });

  it("marks unset program fields as not confirmed rather than omitting them silently", () => {
    const block = buildContextBlock([], programs, {});
    expect(block).toContain("not confirmed");
  });

  it("says explicitly when nothing matched, instead of an empty section", () => {
    const block = buildContextBlock([], [], {});
    expect(block).toContain("no matching verified knowledge base entries");
    expect(block).toContain("no matching active program records");
  });

  it("includes the known student profile so the AI doesn't re-ask", () => {
    const block = buildContextBlock([], [], { nationality: "Iraqi", desired_program: "Cybersecurity" });
    expect(block).toContain("Iraqi");
  });
});
