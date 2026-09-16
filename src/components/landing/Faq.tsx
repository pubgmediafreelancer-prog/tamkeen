"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What documents do I need to apply?",
    a: "Generally: your highest completed certificate (high school for Bachelor's, Bachelor's degree for Master's, Master's degree for Doctoral), academic transcripts, a valid passport or national ID, and a recent passport-sized photo. An English Language Certificate may be required depending on the program.",
  },
  {
    q: "How much is tuition?",
    a: "The published tuition rate is USD 600 per semester, applying to Bachelor's, Higher Diploma, Master's and Doctoral programs. The AI assistant can confirm the exact application fee for your degree level.",
  },
  {
    q: "Are scholarships available?",
    a: "Yes — eligible applicants may receive tuition discounts of up to 30% based on academic achievement, country of residence, or humanitarian criteria, subject to the university's current policies.",
  },
  {
    q: "Is Stardom University's degree recognized in my country?",
    a: "Country-specific recognition always requires confirmation from a human admissions advisor — the AI assistant will connect you rather than guess.",
  },
  {
    q: "Can I study 100% online?",
    a: "Yes, Stardom University programs are delivered as 100% flexible online education.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-(--color-paper-dim) py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-gold)">FAQ</p>
          <h2 className="font-display mt-3 text-3xl sm:text-4xl">Common questions</h2>
        </div>

        <div className="mt-10 divide-y divide-(--color-line) rounded-2xl border border-(--color-line) bg-white shadow-(--shadow-sm)">
          {FAQS.map((f, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{f.q}</span>
                  <span
                    className={`shrink-0 text-(--color-gold) transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
                {isOpen && <p className="px-6 pb-5 text-sm text-(--color-ink)/65">{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
