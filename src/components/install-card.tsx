"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Shows an "Install Coltasi Fit" card when the app is open in a normal Chrome tab.
 * Uses Chrome's real install flow (beforeinstallprompt), which installs it as an app
 * that opens full-screen, instead of a home-screen shortcut that opens a tab.
 */
const STANDALONE = "(display-mode: standalone)";
const HIDE_KEY = "install-card-hidden";
const subscribeStandalone = (cb: () => void) => {
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const isStandalone = () => window.matchMedia(STANDALONE).matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const wasHidden = () => { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } };
const noSubscribe = () => () => {};

export function InstallCard() {
  // Read straight from the browser; on the server the card stays hidden (as if installed).
  const opensAsApp = useSyncExternalStore(subscribeStandalone, isStandalone, () => true);
  const hiddenBefore = useSyncExternalStore(noSubscribe, wasHidden, () => false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const standalone = opensAsApp || installed;
  const hidden = hiddenBefore || dismissed;

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BIPEvent); };
    const onInstalled = () => { setPrompt(null); setInstalled(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || hidden) return null;

  const dismiss = () => { setDismissed(true); try { localStorage.setItem(HIDE_KEY, "1"); } catch {} };

  return (
    <div className="card" style={{ padding: "14px 16px", border: "2px solid var(--ember)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
        <div style={{ flexGrow: 1 }}>
          <p className="ln">Install Coltasi Fit</p>
          <p className="cap">Opens full-screen like a normal app, not in a Chrome tab.</p>
        </div>
      </div>
      {prompt ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ghost" style={{ height: 44 }} onClick={dismiss}>Not now</button>
          <button type="button" className="btn" style={{ height: 44 }}
            onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setInstalled(true); setPrompt(null); }}>
            Install
          </button>
        </div>
      ) : (
        <p className="cap" style={{ lineHeight: 1.45 }}>
          In Chrome, tap <b style={{ color: "var(--navy)" }}>⋮</b> then <b style={{ color: "var(--navy)" }}>Install app</b> (or Add to Home screen, then pick <b style={{ color: "var(--navy)" }}>Install</b>, not Create shortcut).{" "}
          <button type="button" onClick={dismiss} style={{ background: "none", border: 0, padding: 0, color: "var(--ember-text)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Hide</button>
        </p>
      )}
    </div>
  );
}
