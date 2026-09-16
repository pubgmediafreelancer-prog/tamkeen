export type KnowledgeCategory =
  | "UNIVERSITY"
  | "PROGRAMS"
  | "ADMISSIONS"
  | "APPLICATION"
  | "TUITION"
  | "SCHOLARSHIPS"
  | "INTERNATIONAL"
  | "RECOGNITION"
  | "DEGREE_AUTHENTICATION"
  | "FAQ"
  | "POLICIES"
  | "CONTACT"
  | "OTHER";

export interface KnowledgeBaseRow {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  source_url: string;
  source_title: string | null;
  language: "en" | "ar";
  last_verified: string;
  status: "active" | "stale" | "retracted";
}

export type DegreeLevel = "HIGHER_DIPLOMA" | "BACHELOR" | "MASTER" | "DOCTORATE";

export interface ProgramRow {
  id: string;
  program_name: string;
  degree_level: DegreeLevel;
  faculty: string;
  school: string | null;
  description: string | null;
  duration: string | null;
  study_mode: string | null;
  language: string | null;
  tuition: string | null;
  application_fee: string | null;
  requirements: string | null;
  documents_required: string | null;
  scholarship_information: string | null;
  source_url: string;
  last_verified: string;
  active: boolean;
}

export type LeadScore = "HOT" | "WARM" | "COLD";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "APPLICATION_STARTED"
  | "APPLICATION_SUBMITTED"
  | "ENROLLED"
  | "LOST"
  | "UNRESPONSIVE";

export interface StudentProfile {
  first_name?: string;
  last_name?: string;
  nationality?: string;
  country_of_residence?: string;
  education_level?: string;
  certificate_type?: string;
  track?: string;
  percentage?: string;
  graduation_year?: string;
  desired_level?: string;
  desired_faculty?: string;
  desired_program?: string;
  intended_start?: string;
  phone?: string;
  email?: string;
  preferred_language?: string;
  wants_to_apply?: boolean;
  wants_human?: boolean;
}

export interface ChatSource {
  knowledge_item_id?: string;
  program_id?: string;
  title: string;
  source_url: string;
}

export interface AttributionData {
  landing_page?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}
