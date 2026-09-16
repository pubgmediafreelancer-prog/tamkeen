import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { BASE_SYSTEM_PROMPT, buildContextBlock } from "./system-prompt";
import { KnowledgeBaseRow, ProgramRow, StudentProfile } from "@/lib/types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. The AI Admission Agent cannot respond without it — see .env.example."
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export async function generateReply(
  history: ChatTurn[],
  knowledge: KnowledgeBaseRow[],
  programs: ProgramRow[],
  profile: StudentProfile
): Promise<string> {
  const anthropic = getClient();
  const contextBlock = buildContextBlock(knowledge, programs, profile);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: `${BASE_SYSTEM_PROMPT}\n\n${contextBlock}`,
    messages: history.map((h) => ({ role: h.role, content: h.content })),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}

const EXTRACTION_SYSTEM = `You extract structured facts a student has stated about themselves from an admissions chat, for CRM purposes.
Return ONLY a compact JSON object (no prose, no markdown fences) with any of these keys the student has stated or clearly implied, IN THE LATEST MESSAGE OR ANYWHERE EARLIER IN THE CONVERSATION IF NOT ALREADY CAPTURED:
first_name, last_name, nationality, country_of_residence, education_level, certificate_type, percentage, graduation_year, desired_level (BACHELOR|MASTER|DOCTORATE|HIGHER_DIPLOMA), desired_faculty, desired_program, intended_start, phone, email, preferred_language (en|ar), wants_to_apply (boolean), wants_human (boolean).
Omit any key you cannot confidently fill. If nothing new, return {}.`;

export async function extractProfileUpdates(
  history: ChatTurn[],
  currentProfile: StudentProfile
): Promise<Partial<StudentProfile>> {
  try {
    const anthropic = getClient();
    const transcript = history
      .slice(-10)
      .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: EXTRACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Known profile so far: ${JSON.stringify(currentProfile)}\n\nConversation:\n${transcript}\n\nJSON:`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Extraction is best-effort — never let it break the chat turn.
    return {};
  }
}
