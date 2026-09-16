import { ProgramRow } from "@/lib/types";

const FALLBACK_CATEGORIES = [
  { label: "IT & Computing", detail: "Cybersecurity, Software Engineering, Computer Science" },
  { label: "Business Administration", detail: "Business, Management" },
  { label: "Legal Studies", detail: "Media Law, Health Law" },
  { label: "Artificial Intelligence", detail: "Master of Artificial Intelligence" },
];

function groupByFaculty(programs: ProgramRow[]) {
  const map = new Map<string, ProgramRow[]>();
  for (const p of programs) {
    if (!map.has(p.faculty)) map.set(p.faculty, []);
    map.get(p.faculty)!.push(p);
  }
  return map;
}

export function ProgramCategories({ programs }: { programs: ProgramRow[] }) {
  const grouped = groupByFaculty(programs);
  const entries = Array.from(grouped.entries());

  return (
    <section id="programs" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-teal)">Academic areas</p>
        <h2 className="font-display mt-3 text-3xl sm:text-4xl">Programs across every faculty</h2>
        <p className="mt-3 text-(--color-ink)/65">
          Every program below is a verified, active record — the AI assistant only recommends
          programs from this list.
        </p>
      </div>

      {entries.length > 0 ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([faculty, items]) => (
            <div
              key={faculty}
              className="group rounded-2xl border border-(--color-line) bg-white p-6 shadow-(--shadow-sm) transition-all hover:-translate-y-1 hover:shadow-(--shadow-md)"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-teal)/10 text-(--color-teal)">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L2 6l8 4 8-4-8-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M4 9v5c0 1 2.5 3 6 3s6-2 6-3V9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-display text-lg">{faculty}</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-(--color-ink)/65">
                {items.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-(--color-gold)" />
                    {p.program_name} <span className="text-(--color-ink)/40">· {p.degree_level.replace("_", " ").toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FALLBACK_CATEGORIES.map((c) => (
            <div key={c.label} className="rounded-2xl border border-(--color-line) bg-white p-6 shadow-(--shadow-sm)">
              <h3 className="font-display text-lg">{c.label}</h3>
              <p className="mt-2 text-sm text-(--color-ink)/60">{c.detail}</p>
            </div>
          ))}
          <p className="col-span-full mt-2 text-xs text-(--color-ink)/40">
            Showing reference categories — connect Supabase and run{" "}
            <code className="rounded bg-(--color-paper-dim) px-1.5 py-0.5">npm run seed</code> to load verified,
            live program records.
          </p>
        </div>
      )}
    </section>
  );
}
