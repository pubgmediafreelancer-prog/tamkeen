"use client";

import { ReactNode, useEffect, useState } from "react";
import { getAdminToken, setAdminToken } from "@/lib/admin/client";

export function AdminGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // Reads localStorage, which only exists post-mount — this is the
    // sync-with-external-system case the rule's own guidance carves out.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasToken(Boolean(getAdminToken()));
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!hasToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAdminToken(tokenInput.trim());
            setHasToken(true);
          }}
          className="w-full max-w-sm rounded-2xl border border-(--color-line) bg-white p-8 shadow-(--shadow-md)"
        >
          <h1 className="font-display text-xl">Admin access</h1>
          <p className="mt-1 text-sm text-(--color-ink)/60">Enter the admin token configured as ADMIN_TOKEN.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            className="mt-4 w-full rounded-xl border border-(--color-line) px-3.5 py-2.5 text-sm outline-none focus:border-(--color-teal)"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-paper)"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
