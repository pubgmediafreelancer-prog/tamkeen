"use client";

import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/utils/session";
import { track } from "@/lib/utils/track";
import { Field, TextInput, SelectInput } from "./FormControls";
import { ApplicationFormData, EMPTY_APPLICATION, STEPS, DOCUMENT_SLOTS } from "./fields";
import { ProgramRow } from "@/lib/types";

const DRAFT_KEY = "stardom_application_draft";

export function ApplyForm({ programs }: { programs: ProgramRow[] }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ApplicationFormData>(EMPTY_APPLICATION);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Restores a locally-saved draft, which only exists post-mount —
        // sync-with-external-system, not a derived-state anti-pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData({ ...EMPTY_APPLICATION, ...parsed.data });
        setStep(parsed.step ?? 0);
        setApplicationId(parsed.applicationId ?? null);
      } catch {
        // ignore corrupt draft
      }
    }
    track("page_view", { page: "/apply" });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, step, applicationId }));
  }, [data, step, applicationId]);

  function update<K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function saveStep(finalStatus?: "SUBMITTED") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          applicationId: applicationId ?? undefined,
          programId: programs.find((p) => p.program_name === data.desired_program)?.id,
          status: finalStatus ?? "IN_PROGRESS",
          formData: data,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save your application.");
      setApplicationId(json.application.id);
      track(finalStatus === "SUBMITTED" ? "application_submitted" : "application_started", { step });
      if (finalStatus === "SUBMITTED") {
        setSubmitted(json.application.application_number);
        window.localStorage.removeItem(DRAFT_KEY);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    const ok = await saveStep();
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function uploadDocument(key: string, file: File) {
    const form = new FormData();
    form.append("sessionId", getSessionId());
    form.append("documentType", key);
    form.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: form });
    const json = await res.json();
    if (res.ok) {
      setUploaded((u) => ({ ...u, [key]: true }));
      track("document_uploaded", { key });
    } else {
      setError(json.error ?? "Document upload failed.");
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-(--color-line) bg-white p-8 text-center shadow-(--shadow-md)">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--color-teal)/10 text-(--color-teal)">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="font-display text-2xl">Application submitted</h2>
        <p className="mt-2 text-sm text-(--color-ink)/65">
          Your application number is <strong>{submitted}</strong>. Our admissions team will review it and follow up
          by email or phone — this is not yet an admission decision.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="text-xs font-medium text-(--color-ink)/50">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-(--color-line)">
          <div
            className="h-1.5 rounded-full bg-(--color-gold) transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-(--color-line) bg-white p-6 shadow-(--shadow-sm) sm:p-8">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Prefix">
              <SelectInput
                options={["Mr.", "Mrs.", "Ms.", "Dr."]}
                value={data.prefix}
                onChange={(e) => update("prefix", e.target.value)}
              />
            </Field>
            <Field label="Gender" required>
              <SelectInput
                options={["Male", "Female"]}
                value={data.gender}
                onChange={(e) => update("gender", e.target.value)}
              />
            </Field>
            <Field label="First Name" required>
              <TextInput value={data.first_name} onChange={(e) => update("first_name", e.target.value)} required />
            </Field>
            <Field label="Middle Name">
              <TextInput value={data.middle_name} onChange={(e) => update("middle_name", e.target.value)} />
            </Field>
            <Field label="Last Name" required>
              <TextInput value={data.last_name} onChange={(e) => update("last_name", e.target.value)} required />
            </Field>
            <Field label="Marital Status">
              <SelectInput
                options={["Single", "Married", "Divorced", "Widowed"]}
                value={data.marital_status}
                onChange={(e) => update("marital_status", e.target.value)}
              />
            </Field>
            <Field label="Date of Birth" required>
              <TextInput type="date" value={data.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
            </Field>
            <Field label="Nationality" required>
              <TextInput value={data.nationality} onChange={(e) => update("nationality", e.target.value)} />
            </Field>
            <Field label="Country of Residence" required>
              <TextInput value={data.country_of_residence} onChange={(e) => update("country_of_residence", e.target.value)} />
            </Field>
            <Field label="Passport Number">
              <TextInput value={data.passport_number} onChange={(e) => update("passport_number", e.target.value)} />
            </Field>
            <Field label="Passport Expiry Date">
              <TextInput type="date" value={data.passport_expiry_date} onChange={(e) => update("passport_expiry_date", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Primary Phone" required>
              <TextInput type="tel" value={data.primary_phone} onChange={(e) => update("primary_phone", e.target.value)} />
            </Field>
            <Field label="Alternative Phone">
              <TextInput type="tel" value={data.alternative_phone} onChange={(e) => update("alternative_phone", e.target.value)} />
            </Field>
            <Field label="Email" required className="sm:col-span-2">
              <TextInput type="email" value={data.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <TextInput value={data.address} onChange={(e) => update("address", e.target.value)} />
            </Field>
            <Field label="City">
              <TextInput value={data.city} onChange={(e) => update("city", e.target.value)} />
            </Field>
            <Field label="State / Province">
              <TextInput value={data.state_province} onChange={(e) => update("state_province", e.target.value)} />
            </Field>
            <Field label="Country" required>
              <TextInput value={data.country} onChange={(e) => update("country", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Highest Education Level" required>
              <SelectInput
                options={["High School", "Diploma", "Bachelor's", "Master's", "Doctorate"]}
                value={data.education_level}
                onChange={(e) => update("education_level", e.target.value)}
              />
            </Field>
            <Field label="Certificate Type">
              <TextInput value={data.certificate_type} onChange={(e) => update("certificate_type", e.target.value)} />
            </Field>
            <Field label="Track / Stream">
              <TextInput value={data.track} onChange={(e) => update("track", e.target.value)} />
            </Field>
            <Field label="Percentage / GPA">
              <TextInput value={data.percentage} onChange={(e) => update("percentage", e.target.value)} />
            </Field>
            <Field label="Graduation Year" required>
              <TextInput value={data.graduation_year} onChange={(e) => update("graduation_year", e.target.value)} />
            </Field>
            <Field label="Country of Education">
              <TextInput value={data.education_country} onChange={(e) => update("education_country", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Desired Degree Level" required>
              <SelectInput
                options={["HIGHER_DIPLOMA", "BACHELOR", "MASTER", "DOCTORATE"]}
                value={data.desired_level}
                onChange={(e) => update("desired_level", e.target.value)}
              />
            </Field>
            <Field label="Desired Faculty">
              <TextInput value={data.desired_faculty} onChange={(e) => update("desired_faculty", e.target.value)} />
            </Field>
            <Field label="Desired Program" required className="sm:col-span-2">
              <SelectInput
                options={programs
                  .filter((p) => !data.desired_level || p.degree_level === data.desired_level)
                  .map((p) => p.program_name)}
                value={data.desired_program}
                onChange={(e) => update("desired_program", e.target.value)}
              />
            </Field>
            <Field label="Alternative Program">
              <TextInput value={data.alternative_program} onChange={(e) => update("alternative_program", e.target.value)} />
            </Field>
            <Field label="Intended Start">
              <TextInput value={data.intended_start} onChange={(e) => update("intended_start", e.target.value)} placeholder="e.g. Fall 2026" />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Employment Status">
              <SelectInput
                options={["Employed", "Unemployed", "Self-employed", "Student"]}
                value={data.employment_status}
                onChange={(e) => update("employment_status", e.target.value)}
              />
            </Field>
            <Field label="Current Job Sector">
              <TextInput value={data.current_job_sector} onChange={(e) => update("current_job_sector", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-(--color-ink)/60">
              Accepted formats: PDF, JPEG, PNG, WEBP — up to 10MB each. Documents are stored securely and are never
              publicly accessible.
            </p>
            {DOCUMENT_SLOTS.map((slot) => (
              <div
                key={slot.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-(--color-line) px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {slot.label} {slot.required && <span className="text-(--color-gold)">*</span>}
                  </p>
                  {uploaded[slot.key] && <p className="text-xs text-(--color-teal)">Uploaded</p>}
                </div>
                <label className="cursor-pointer rounded-lg border border-(--color-line) px-3 py-1.5 text-xs font-medium transition-colors hover:bg-(--color-paper-dim)">
                  {uploaded[slot.key] ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocument(slot.key, file);
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <Field label="How did you hear about us?">
              <SelectInput
                options={["Social Media", "Search Engine", "Friend / Family", "Advisor / Agent", "Other"]}
                value={data.how_did_you_hear}
                onChange={(e) => update("how_did_you_hear", e.target.value)}
              />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.consent_privacy}
                onChange={(e) => update("consent_privacy", e.target.checked)}
                className="mt-0.5"
              />
              I have read and accept the Privacy Notice and consent to my data being processed for admissions purposes.
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.consent_accuracy}
                onChange={(e) => update("consent_accuracy", e.target.checked)}
                className="mt-0.5"
              />
              I declare that the information provided is accurate and complete to the best of my knowledge.
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.consent_program_nature}
                onChange={(e) => update("consent_program_nature", e.target.checked)}
                className="mt-0.5"
              />
              I understand the nature of the program (100% online) and that submission does not guarantee admission —
              final decisions are made by Stardom University.
            </label>
          </div>
        )}

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0 || saving}
            className="rounded-full border border-(--color-line) px-5 py-2.5 text-sm font-medium disabled:opacity-30"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={saving}
              className="rounded-full bg-(--color-ink) px-6 py-2.5 text-sm font-medium text-(--color-paper) transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          ) : (
            <button
              onClick={() => saveStep("SUBMITTED")}
              disabled={saving || !data.consent_privacy || !data.consent_accuracy || !data.consent_program_nature}
              className="rounded-full bg-(--color-gold) px-6 py-2.5 text-sm font-semibold text-(--color-ink) transition-transform hover:scale-[1.02] disabled:opacity-40"
            >
              {saving ? "Submitting…" : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
