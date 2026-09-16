const POINTS = [
  {
    title: "100% Flexible Online Education",
    body: "Study from anywhere on a modern digital learning platform, at a pace that fits your life.",
  },
  {
    title: "Faculties across six academic areas",
    body: "Business, IT & Computing, Education, Law, Media, and Arts & Languages — bachelor's through doctoral.",
  },
  {
    title: "Scholarships & tuition support",
    body: "Eligible applicants may receive tuition discounts of up to 30%, based on published eligibility criteria.",
  },
  {
    title: "Dedicated admissions support",
    body: "The AI assistant hands off to a real human advisor the moment your question needs one.",
  },
];

export function WhyStardom() {
  return (
    <section className="bg-(--color-paper-dim) py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-gold)">Why Stardom</p>
          <h2 className="font-display mt-3 text-3xl sm:text-4xl">Built for students who study on their terms</h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <div key={p.title} className="flex gap-4">
              <span className="font-display shrink-0 text-2xl text-(--color-gold)">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="font-medium">{p.title}</h3>
                <p className="mt-1 text-sm text-(--color-ink)/65">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
