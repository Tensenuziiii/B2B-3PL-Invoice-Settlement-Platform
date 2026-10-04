"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRouteGate() {
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("vecto_access_token="))
      ?.split("=")[1];

    router.replace(token ? "/dispatch" : "/login");
  }, [router]);

  return null;
}
