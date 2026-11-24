"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Registers the service worker (public/sw.js) on mount. Renders nothing.
 * Runs app-wide (mounted in the root layout) so login/signup are covered
 * too, not just the authenticated app shell.
 *
 * Also tells the worker the page is up ("ready"). If the worker showed a saved
 * copy of this screen for speed, it answers "refresh" and the live data loads in.
 */
export function RegisterServiceWorker() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "refresh") router.refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.controller?.postMessage({ type: "ready" });

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
