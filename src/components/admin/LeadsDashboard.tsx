"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch, clearAdminToken } from "@/lib/admin/client";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  primary_phone: string | null;
  country_of_residence: string | null;
  desired_program: string | null;
  desired_level: string | null;
  lead_score: "HOT" | "WARM" | "COLD" | null;
  lead_status: string;
  human_followup_required: boolean;
  source: string | null;
  utm_campaign: string | null;
  created_at: string;
}

const scoreColor: Record<string, string> = {
  HOT: "bg-red-100 text-red-700",
  WARM: "bg-amber-100 text-amber-700",
  COLD: "bg-slate-100 text-slate-600",
};

export function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (scoreFilter) params.set("score", scoreFilter);
    const res = await adminFetch(`/api/admin/leads?${params.toString()}`);
    if (res.status === 401) {
      clearAdminToken();
      window.location.reload();
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load leads.");
      return;
    }
    setLeads(json.leads);
  }, [statusFilter, scoreFilter]);

  useEffect(() => {
    // Fetches from the admin API (an external system) on mount/filter
    // change — setState happens inside the async response handler, not
    // synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (!leads) return null;
    return {
      total: leads.length,
      hot: leads.filter((l) => l.lead_score === "HOT").length,
      warm: leads.filter((l) => l.lead_score === "WARM").length,
      applications: leads.filter((l) => l.lead_status.startsWith("APPLICATION")).length,
      enrolled: leads.filter((l) => l.lead_status === "ENROLLED").length,
    };
  }, [leads]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl">Admissions Dashboard</h1>
        <button
          onClick={() => {
            clearAdminToken();
            window.location.reload();
          }}
          className="text-xs font-medium text-(--color-ink)/50 hover:text-(--color-ink)"
        >
          Sign out
        </button>
      </div>

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            ["Total Leads", stats.total],
            ["Hot Leads", stats.hot],
            ["Warm Leads", stats.warm],
            ["Applications", stats.applications],
            ["Enrolled", stats.enrolled],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-(--color-line) bg-white p-4">
              <p className="text-xs text-(--color-ink)/50">{label}</p>
              <p className="font-display mt-1 text-2xl">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
          className="rounded-lg border border-(--color-line) px-3 py-2 text-sm"
        >
          <option value="">All scores</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-(--color-line) px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {["NEW", "CONTACTED", "QUALIFIED", "APPLICATION_STARTED", "APPLICATION_SUBMITTED", "ENROLLED", "LOST", "UNRESPONSIVE"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-(--color-line) bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-(--color-line) bg-(--color-paper-dim) text-left text-xs uppercase text-(--color-ink)/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((l) => (
              <tr key={l.id} className="border-b border-(--color-line) last:border-0 hover:bg-(--color-paper-dim)/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-(--color-teal) hover:underline">
                    {[l.first_name, l.last_name].filter(Boolean).join(" ") || "(unnamed)"}
                  </Link>
                  {l.human_followup_required && (
                    <span className="ml-2 rounded-full bg-(--color-gold)/15 px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
                      needs human
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-(--color-ink)/70">{l.desired_program ?? "—"}</td>
                <td className="px-4 py-3 text-(--color-ink)/70">{l.country_of_residence ?? "—"}</td>
                <td className="px-4 py-3">
                  {l.lead_score && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor[l.lead_score]}`}>
                      {l.lead_score}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-(--color-ink)/70">{l.lead_status}</td>
                <td className="px-4 py-3 text-(--color-ink)/70">{l.source ?? "—"}</td>
                <td className="px-4 py-3 text-(--color-ink)/50">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {leads && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-(--color-ink)/40">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
