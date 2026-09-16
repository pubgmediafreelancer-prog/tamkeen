import { LeadScore, StudentProfile } from "@/lib/types";

/**
 * Lead scoring is ONLY for sales/follow-up prioritization. It must never be
 * treated as, or presented as, an admissions decision.
 */
export function scoreLead(profile: StudentProfile): LeadScore {
  const hasContact = Boolean(profile.phone || profile.email);
  const hasAcademicBackground = Boolean(profile.education_level || profile.graduation_year);
  const hasClearInterest = Boolean(profile.desired_program || profile.desired_faculty);
  const hasDegreeLevel = Boolean(profile.desired_level);

  if (profile.wants_to_apply && hasContact && hasClearInterest) {
    return "HOT";
  }

  if (hasContact && (hasClearInterest || hasDegreeLevel) && hasAcademicBackground) {
    return "HOT";
  }

  if (hasClearInterest || hasDegreeLevel || hasAcademicBackground) {
    return "WARM";
  }

  return "COLD";
}

export function requiresHumanFollowup(profile: StudentProfile, lastMessage: string): {
  required: boolean;
  reason?: string;
} {
  const lower = lastMessage.toLowerCase();
  if (profile.wants_human) return { required: true, reason: "Student explicitly requested a human advisor." };
  if (profile.wants_to_apply) return { required: true, reason: "Student wants to apply." };

  const triggers: Array<[RegExp, string]> = [
    [/transfer credit|credit transfer|equivalen/i, "Transfer-credit / equivalency question."],
    [/recogni[sz]e|recognition in|accepted in my country/i, "Country-specific recognition question."],
    [/accredit/i, "Accreditation confirmation requested."],
    [/visa/i, "Visa requirements question."],
    [/refund|payment (failed|issue)|charged twice/i, "Payment issue."],
    [/document (rejected|issue|problem)/i, "Document issue."],
    [/complain|complaint|unhappy|frustrated/i, "Complaint."],
    [/speak to (a )?human|real person|advisor|agent please/i, "Explicit human request."],
  ];

  for (const [pattern, reason] of triggers) {
    if (pattern.test(lower)) return { required: true, reason };
  }

  return { required: false };
}
