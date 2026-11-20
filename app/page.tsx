"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: "/admin",
  DISPATCH_MANAGER: "/dispatch",
  DRIVER: "/driver",
  AUDITOR: "/audit",
  ACCOUNTS: "/accounts",
  CLIENT_AP: "/client-portal",
  VENDOR_3PL: "/vendor-portal",
};

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function clearAuthCookie() {
  document.cookie = "vecto_access_token=; path=/; max-age=0; SameSite=Lax";
}

export default function RootRouteGate() {
  const router = useRouter();

  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("vecto_access_token="))
      ?.split("=")[1];

    if (!raw) {
      router.replace("/login");
      return;
    }

    const payload = parseJwtPayload(raw);

    // If token is missing, malformed, or expired — clear it and go to login
    if (!payload || typeof payload.exp !== "number" || Date.now() / 1000 > payload.exp) {
      clearAuthCookie();
      router.replace("/login");
      return;
    }

    const role = payload.role as string;
    const dest = ROLE_ROUTES[role] ?? "/login";
    router.replace(dest);
  }, [router]);

  return null;
}
