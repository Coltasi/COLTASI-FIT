"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Mounted inside the signed-in app shell.
 * - Asks the service worker to cache the main screens (and the JS/CSS they
 *   need) so the app opens offline. The worker throttles this itself.
 * - Shows a banner while offline, since screens are then last-synced copies
 *   and anything you save won't go through.
 * - Refreshes the current screen with live data when the connection returns.
 */
export function OfflineSupport() {
  const router = useRouter();
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const warm = () => {
      if (!navigator.onLine) return;
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "warm" }))
        .catch(() => {});
    };

    const goOnline = () => {
      router.refresh();
      warm();
    };

    // Let the current screen finish loading before warming the others.
    const t = window.setTimeout(warm, 3000);

    window.addEventListener("online", goOnline);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", goOnline);
    };
  }, [router]);

  if (!offline) return null;
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "calc(env(safe-area-inset-top) + 8px) 16px 8px",
        background: "var(--navy, #153261)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
        lineHeight: 1.35,
      }}
    >
      You&apos;re offline. Showing your last synced data; changes won&apos;t save until you reconnect.
    </div>
  );
}
