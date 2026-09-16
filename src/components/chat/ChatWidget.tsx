"use client";

import { useEffect, useRef, useState } from "react";
import { getSessionId, getAttribution } from "@/lib/utils/session";
import { track } from "@/lib/utils/track";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! I'm the Stardom University admissions assistant.\n\nI can help you with:\n• Programs\n• Admission requirements\n• Tuition information\n• Scholarships\n• Application process\n• International student questions\n\nWhat would you like to know?",
};

export function ChatWidget({ open, onClose, embedded = false }: { open: boolean; onClose: () => void; embedded?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [humanFlag, setHumanFlag] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      track("chat_started");
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    track("question_asked", { length: trimmed.length });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          message: trimmed,
          attribution: getAttribution(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Something went wrong." }));
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              err.error ??
              "I'm having trouble connecting right now. Please try again in a moment, or reach admissions directly at admission@stardomuniversity.edu.eu.",
          },
        ]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.reply }]);
      if (data.humanFollowupRequired) setHumanFlag(data.humanFollowupReason ?? "A human advisor can help with this.");
      else setHumanFlag(null);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I couldn't reach the server. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={
        embedded
          ? "flex h-full w-full flex-col overflow-hidden rounded-2xl border border-(--color-line) bg-white shadow-(--shadow-lg)"
          : "fixed bottom-4 right-4 z-50 flex h-[min(680px,calc(100vh-2rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-(--color-line) bg-white shadow-(--shadow-lg) animate-rise"
      }
      role="dialog"
      aria-label="Stardom University admissions assistant chat"
    >
      <header className="flex items-center justify-between gap-3 bg-(--color-ink) px-5 py-4 text-(--color-paper)">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-(--color-teal)">
            <span className="text-sm font-semibold">S</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-(--color-ink) bg-(--color-teal-bright) animate-pulse-dot" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Admissions Assistant</p>
            <p className="text-xs text-(--color-paper)/60 leading-tight">Stardom University</p>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-full p-1.5 text-(--color-paper)/70 transition-colors hover:bg-white/10 hover:text-(--color-paper)"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-(--color-paper-dim) px-4 py-5">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-(--color-ink) px-4 py-2.5 text-sm text-(--color-paper) shadow-(--shadow-sm)"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-(--color-line) bg-white px-4 py-2.5 text-sm text-(--color-ink) shadow-(--shadow-sm)"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-(--color-line) bg-white px-4 py-3 shadow-(--shadow-sm)">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-(--color-ink)/40 animate-pulse-dot"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        {humanFlag && (
          <div className="rounded-xl border border-(--color-gold)/40 bg-(--color-gold)/10 px-4 py-3 text-xs text-(--color-ink)">
            <p className="font-medium">This may need a human advisor.</p>
            <p className="mt-0.5 text-(--color-ink)/70">
              I&apos;ve flagged this for the admissions team. You can also email{" "}
              <a className="underline" href="mailto:admission@stardomuniversity.edu.eu">
                admission@stardomuniversity.edu.eu
              </a>{" "}
              or continue chatting here.
            </p>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-end gap-2 border-t border-(--color-line) bg-white p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          rows={1}
          placeholder="Ask about programs, tuition, requirements…"
          className="max-h-28 flex-1 resize-none rounded-xl border border-(--color-line) bg-(--color-paper-dim) px-3.5 py-2.5 text-sm text-(--color-ink) outline-none transition-colors focus:border-(--color-teal) placeholder:text-(--color-ink)/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-teal) text-white transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
            <path d="M2 10l16-7-6 16-2.5-6.5L2 10z" fill="currentColor" />
          </svg>
        </button>
      </form>
    </div>
  );
}
