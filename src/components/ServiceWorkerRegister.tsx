"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const swPath = `${basePath}/sw.js`;
      navigator.serviceWorker
        .register(swPath)
        .catch(() => {
          /* noop */
        });
    }
  }, []);
  return null;
}

