"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Shows an "Install Coltasi" card when the app is open in a normal Chrome tab.
 * Uses Chrome's real install flow (beforeinstallprompt), which installs it as an app
 * that opens full-screen, instead of a home-screen shortcut that opens a tab.
 */
export function InstallCard() {
  const [standalone, setStandalone] = useState(true);
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const isStandalone = mq.matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    try { setHidden(localStorage.getItem("install-card-hidden") === "1"); } catch {}
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BIPEvent); };
    const onInstalled = () => { setPrompt(null); setStandalone(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || hidden) return null;

  const dismiss = () => { setHidden(true); try { localStorage.setItem("install-card-hidden", "1"); } catch {} };

  return (
    <div className="card" style={{ padding: "14px 16px", border: "2px solid var(--ember)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
        <div style={{ flexGrow: 1 }}>
          <p className="ln">Install Coltasi</p>
          <p className="cap">Opens full-screen like a normal app, not in a Chrome tab.</p>
        </div>
      </div>
      {prompt ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ghost" style={{ height: 44 }} onClick={dismiss}>Not now</button>
          <button type="button" className="btn" style={{ height: 44 }}
            onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setStandalone(true); setPrompt(null); }}>
            Install
          </button>
        </div>
      ) : (
        <p className="cap" style={{ lineHeight: 1.45 }}>
          In Chrome, tap <b style={{ color: "var(--navy)" }}>⋮</b> then <b style={{ color: "var(--navy)" }}>Install app</b> (or Add to Home screen, then pick <b style={{ color: "var(--navy)" }}>Install</b>, not Create shortcut).{" "}
          <button type="button" onClick={dismiss} style={{ background: "none", border: 0, padding: 0, color: "var(--kingfisher-text)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Hide</button>
        </p>
      )}
    </div>
  );
}
