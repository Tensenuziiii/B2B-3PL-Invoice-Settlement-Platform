"use client";

import React, { useEffect, useState } from "react";

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCKS !== "true") {
      setReady(true);
      return;
    }
    if (typeof window === "undefined") return;

    let cancelled = false;
    import("@/mocks/browser")
      .then(({ worker }) =>
        worker.start({
          onUnhandledFrame: "bypass",
          quiet: true,
          ...({ onUnhandledRequest: "bypass" }),
        } as Parameters<typeof worker.start>[0])
      )
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) setReady(true); });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
