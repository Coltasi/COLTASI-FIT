"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) on mount. Renders nothing.
 * Runs app-wide (mounted in the root layout) so login/signup are covered
 * too, not just the authenticated app shell.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  }, []);

  return null;
}
