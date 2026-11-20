export function getDisplayName(obj: unknown, fallback = "—"): string {
  if (obj == null) return fallback;
  if (typeof obj === "string") return obj || fallback;
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (typeof o.name === "string" && o.name) return o.name;
    if (typeof o.regNo === "string" && o.regNo) return o.regNo;
    if (typeof o.code === "string" && o.code) return o.code;
    if (typeof o.invoiceNumber === "string" && o.invoiceNumber) return o.invoiceNumber;
    if (typeof o.tripNumber === "string" && o.tripNumber) return o.tripNumber;
    if (typeof o.settlementNumber === "string" && o.settlementNumber) return o.settlementNumber;
    if (typeof o.disputeNumber === "string" && o.disputeNumber) return o.disputeNumber;
  }
  return fallback;
}

export function paiseToRupees(paise: number | null | undefined): number {
  if (paise == null) return 0;
  return paise / 100;
}

export function formatRupees(paise: number | null | undefined): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function logoutUser(router?: { push: (url: string) => void }): Promise<void> {
  try {
    const { apiClient } = await import("@/lib/api/client");
    await apiClient.post("/auth/logout", {});
  } catch {
    // ignore — best-effort
  }
  if (typeof document !== "undefined") {
    document.cookie = "vecto_access_token=; path=/; max-age=0";
  }
  if (router) {
    router.push("/login");
  } else if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export function getCurrentUser(): { role?: string; sub?: string; email?: string; [key: string]: unknown } | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    if (cookie.startsWith("vecto_access_token=")) {
      const token = decodeURIComponent(cookie.slice("vecto_access_token=".length));
      try {
        const parts = token.split(".");
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          return payload;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

