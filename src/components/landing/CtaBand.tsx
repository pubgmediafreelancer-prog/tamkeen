import Link from "next/link";

export function CtaBand() {
  return (
    <section className="bg-(--color-ink) py-20 text-(--color-paper)">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-3xl sm:text-4xl">Ready to take the next step?</h2>
        <p className="mt-3 text-(--color-paper)/70">
          Start your application, or talk to a human advisor if you have questions the assistant can&apos;t answer.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/apply"
            className="rounded-full bg-(--color-gold) px-6 py-3.5 text-sm font-semibold text-(--color-ink) shadow-(--shadow-lg) transition-transform hover:scale-[1.03]"
          >
            Start Your Application
          </Link>
          <a
            href="mailto:admission@stardomuniversity.edu.eu"
            className="rounded-full border border-(--color-paper)/25 px-6 py-3.5 text-sm font-medium transition-colors hover:bg-white/5"
          >
            Talk to a Human Advisor
          </a>
        </div>
      </div>
    </section>
  );
}
