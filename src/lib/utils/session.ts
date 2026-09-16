"use client";

const SESSION_KEY = "stardom_session_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Stable per-visitor session id, persisted so a returning tab resumes the same lead/conversation. */
export function getSessionId(): string {
  if (typeof window === "undefined") return randomId();
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface Attribution {
  landing_page?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const ATTRIBUTION_KEY = "stardom_attribution";

/** Captures UTM params + landing page/referrer on first touch and preserves them for the whole session. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const existing = window.localStorage.getItem(ATTRIBUTION_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // fall through to recompute
    }
  }

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
    landing_page: window.location.pathname,
    referrer: document.referrer || undefined,
    utm_source: params.get("utm_source") ?? undefined,
    utm_medium: params.get("utm_medium") ?? undefined,
    utm_campaign: params.get("utm_campaign") ?? undefined,
    utm_content: params.get("utm_content") ?? undefined,
    utm_term: params.get("utm_term") ?? undefined,
  };

  window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}
