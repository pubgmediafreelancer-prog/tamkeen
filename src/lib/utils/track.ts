"use client";
import { getSessionId } from "./session";

export function track(eventType: string, metadata: Record<string, unknown> = {}) {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: getSessionId(), eventType, metadata }),
      keepalive: true,
    });
  } catch {
    // analytics must never break the UI
  }
}
