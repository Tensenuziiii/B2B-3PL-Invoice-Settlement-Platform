import type { RefreshResponse } from "./types";

let refreshPromise: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function doRefresh(): Promise<boolean> {
  if (typeof document === "undefined") return false; // SSR-safe
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const { accessToken } = (await res.json()) as RefreshResponse;
    document.cookie = `vecto_access_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}
