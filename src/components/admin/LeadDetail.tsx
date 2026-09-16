"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/client";

interface Conversation {
  id: string;
  role: string;
  message: string;
  created_at: string;
}

export function LeadDetail({ id }: { id: string }) {
  const [data, setData] = useState<{
    lead: Record<string, unknown>;
    conversations: Conversation[];
    applications: Record<string, unknown>[];
    documents: Record<string, unknown>[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch(`/api/admin/leads/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="p-10 text-red-700">{error}</p>;
  if (!data) return <p className="p-10 text-(--color-ink)/50">Loading…</p>;

  const { lead, conversations, applications, documents } = data;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-xs font-medium text-(--color-teal)">
        ← Back to dashboard
      </Link>

      <h1 className="font-display mt-3 text-2xl">
        {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed lead"}
      </h1>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-(--color-line) bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--color-ink)/50">Student</h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Email", lead.email],
              ["Phone", lead.primary_phone],
              ["Nationality", lead.nationality],
              ["Country of residence", lead.country_of_residence],
              ["Education level", lead.education_level],
              ["Graduation year", lead.graduation_year],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4">
                <dt className="text-(--color-ink)/50">{String(label)}</dt>
                <dd className="text-right">{value ? String(value) : "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-(--color-line) bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--color-ink)/50">Lead</h2>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Desired level", lead.desired_level],
              ["Desired program", lead.desired_program],
              ["Score", lead.lead_score],
              ["Status", lead.lead_status],
              ["Source", lead.source],
              ["Campaign", lead.utm_campaign],
              ["Needs human follow-up", lead.human_followup_required ? `Yes — ${lead.human_followup_reason ?? ""}` : "No"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4">
                <dt className="text-(--color-ink)/50">{String(label)}</dt>
                <dd className="text-right">{value ? String(value) : "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {applications.length > 0 && (
        <section className="mt-6 rounded-2xl border border-(--color-line) bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--color-ink)/50">Applications</h2>
          {applications.map((a) => (
            <div key={a.id as string} className="flex justify-between border-b border-(--color-line) py-2 text-sm last:border-0">
              <span>{(a.application_number as string) ?? "Draft"}</span>
              <span className="text-(--color-ink)/60">{a.status as string}</span>
            </div>
          ))}
        </section>
      )}

      {documents.length > 0 && (
        <section className="mt-6 rounded-2xl border border-(--color-line) bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--color-ink)/50">Documents</h2>
          {documents.map((d) => (
            <div key={d.id as string} className="flex justify-between border-b border-(--color-line) py-2 text-sm last:border-0">
              <span>{d.document_type as string}</span>
              <span className="text-(--color-ink)/60">{d.status as string}</span>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-(--color-line) bg-white p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--color-ink)/50">Conversation</h2>
        <div className="max-h-[420px] space-y-3 overflow-y-auto">
          {conversations.map((c) => (
            <div key={c.id} className={`flex ${c.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3.5 py-2 text-sm ${
                  c.role === "user" ? "bg-(--color-ink) text-(--color-paper)" : "bg-(--color-paper-dim)"
                }`}
              >
                {c.message}
              </div>
            </div>
          ))}
          {conversations.length === 0 && <p className="text-sm text-(--color-ink)/40">No conversation yet.</p>}
        </div>
      </section>
    </div>
  );
}
