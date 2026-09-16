"use client";

import { ChatWidget } from "@/components/chat/ChatWidget";
import { OPEN_CHAT_EVENT } from "@/components/chat/ChatLauncher";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-(--color-ink) text-(--color-paper)">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(200,149,44,0.25), transparent 45%), radial-gradient(circle at 85% 0%, rgba(15,122,111,0.35), transparent 40%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-rise">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-(--color-gold)/40 bg-(--color-gold)/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-(--color-gold-bright)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--color-gold-bright)" />
            AI-guided admissions
          </p>
          <h1 className="font-display text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            Find the Right Degree
            <br />
            for Your <span className="italic text-(--color-gold-bright)">Future</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-(--color-paper)/75">
            Explore programs, admission requirements and application options with our AI
            admissions assistant — grounded in Stardom University&apos;s official, verified
            information.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button
              onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
              className="group inline-flex items-center gap-2.5 rounded-full bg-(--color-gold) px-6 py-3.5 text-sm font-semibold text-(--color-ink) shadow-(--shadow-lg) transition-transform hover:scale-[1.03]"
            >
              Ask the AI Admissions Assistant
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                <path d="M2 8h11M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <a
              href="#programs"
              className="inline-flex items-center gap-2 rounded-full border border-(--color-paper)/25 px-6 py-3.5 text-sm font-medium text-(--color-paper) transition-colors hover:bg-white/5"
            >
              Explore Programs
            </a>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-(--color-paper)/60">
            <span>100% Flexible Online Education</span>
            <span className="hidden sm:inline">·</span>
            <span>Faculties across IT, Business, Law, Education & Media</span>
          </div>
        </div>

        <div className="relative hidden h-[520px] lg:block">
          <div className="absolute inset-0 rounded-3xl border border-(--color-paper)/10 bg-(--color-ink-soft) p-4 shadow-(--shadow-lg)">
            <ChatWidget open onClose={() => {}} embedded />
          </div>
        </div>
      </div>
    </section>
  );
}
