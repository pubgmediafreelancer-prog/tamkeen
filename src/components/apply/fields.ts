export interface ApplicationFormData {
  // Step 1 — Personal
  prefix: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  marital_status: string;
  date_of_birth: string;
  nationality: string;
  country_of_residence: string;
  passport_number: string;
  passport_expiry_date: string;

  // Step 2 — Contact
  primary_phone: string;
  alternative_phone: string;
  email: string;
  address: string;
  city: string;
  state_province: string;
  country: string;

  // Step 3 — Academic
  education_level: string;
  certificate_type: string;
  track: string;
  percentage: string;
  graduation_year: string;
  education_country: string;

  // Step 4 — Program
  desired_level: string;
  desired_faculty: string;
  desired_program: string;
  alternative_program: string;
  intended_start: string;

  // Step 5 — Professional
  employment_status: string;
  current_job_sector: string;

  // Step 7 — Declarations / marketing
  how_did_you_hear: string;
  consent_privacy: boolean;
  consent_accuracy: boolean;
  consent_program_nature: boolean;
}

export const EMPTY_APPLICATION: ApplicationFormData = {
  prefix: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  marital_status: "",
  date_of_birth: "",
  nationality: "",
  country_of_residence: "",
  passport_number: "",
  passport_expiry_date: "",
  primary_phone: "",
  alternative_phone: "",
  email: "",
  address: "",
  city: "",
  state_province: "",
  country: "",
  education_level: "",
  certificate_type: "",
  track: "",
  percentage: "",
  graduation_year: "",
  education_country: "",
  desired_level: "",
  desired_faculty: "",
  desired_program: "",
  alternative_program: "",
  intended_start: "",
  employment_status: "",
  current_job_sector: "",
  how_did_you_hear: "",
  consent_privacy: false,
  consent_accuracy: false,
  consent_program_nature: false,
};

export const STEPS = [
  "Personal",
  "Contact",
  "Academic",
  "Program",
  "Professional",
  "Documents",
  "Declarations",
] as const;

export const DOCUMENT_SLOTS: { key: string; label: string; required: boolean }[] = [
  { key: "PHOTO", label: "Personal Photo", required: true },
  { key: "PASSPORT", label: "Passport", required: true },
  { key: "HIGH_SCHOOL_DIPLOMA", label: "High School Diploma / prior degree", required: true },
  { key: "ACADEMIC_TRANSCRIPT", label: "Academic Transcript", required: false },
  { key: "OTHER_CERTIFICATE", label: "Other Certificates", required: false },
  { key: "OTHER_ATTACHMENT", label: "Other Attachments", required: false },
];
