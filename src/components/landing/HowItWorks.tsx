const STEPS = [
  { title: "Ask", body: "Chat with the AI assistant about programs, requirements, tuition or scholarships." },
  { title: "Get verified answers", body: "Every answer is grounded in Stardom University's official published information." },
  { title: "Build your profile", body: "Share your background naturally — no long forms up front." },
  { title: "Apply", body: "Move into the guided application when you're ready, with your info carried over." },
  { title: "Human follow-up", body: "An admissions advisor steps in for anything that needs a real decision." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-teal)">How it works</p>
        <h2 className="font-display mt-3 text-3xl sm:text-4xl">From your first question to enrollment</h2>
      </div>

      <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-(--color-ink) font-display text-(--color-gold-bright)">
              {i + 1}
            </div>
            <h3 className="font-medium">{s.title}</h3>
            <p className="mt-1.5 text-sm text-(--color-ink)/60">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
