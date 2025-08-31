"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const v = process.env.NEXT_PUBLIC_SW_VERSION || "dev";
      const swPath = `${basePath}/sw.js?v=${encodeURIComponent(v)}`;
      navigator.serviceWorker
        .register(swPath)
        .catch(() => {
          /* noop */
        });
    }
  }, []);
  return null;
}
