"use client";

import { useEffect, useState } from "react";
import { ChatWidget } from "./ChatWidget";

export const OPEN_CHAT_EVENT = "stardom:open-chat";

export function ChatLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, handler);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handler);
  }, []);

  return (
    <>
      <ChatWidget open={open} onClose={() => setOpen(false)} />
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-(--color-ink) px-5 py-3.5 text-sm font-medium text-(--color-paper) shadow-(--shadow-lg) transition-transform hover:scale-105"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--color-teal-bright) opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-(--color-teal-bright)" />
          </span>
          Ask the AI Admissions Assistant
        </button>
      )}
    </>
  );
}
