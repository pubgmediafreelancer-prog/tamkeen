"use client";

const TOKEN_KEY = "stardom_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export async function adminFetch(path: string): Promise<Response> {
  const token = getAdminToken();
  return fetch(path, { headers: token ? { "x-admin-token": token } : {} });
}
