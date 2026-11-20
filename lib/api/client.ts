import { tryRefresh } from "./refresh";
import type { ApiErrorShape } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length));
    }
  }
  return undefined;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  const token = readCookie("vecto_access_token");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) return apiFetch<T>(path, init, false);
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "UNAUTHORIZED", "Session expired");
  }

  if (!res.ok) {
    let body: ApiErrorShape | null = null;
    try {
      body = (await res.json()) as ApiErrorShape;
    } catch {
      /* ignore */
    }
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(p: string) => apiFetch<T>(p, { method: "GET" }),
  post: <T>(p: string, b?: unknown) =>
    apiFetch<T>(p, {
      method: "POST",
      body: b !== undefined ? JSON.stringify(b) : undefined,
    }),
  patch: <T>(p: string, b?: unknown) =>
    apiFetch<T>(p, {
      method: "PATCH",
      body: b !== undefined ? JSON.stringify(b) : undefined,
    }),
  delete: <T>(p: string) => apiFetch<T>(p, { method: "DELETE" }),
};
