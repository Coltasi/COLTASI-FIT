"use client";

import { useEffect, type ReactNode } from "react";

/** Bottom sheet over a navy backdrop. Tapping the backdrop or Close dismisses it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(14,36,71,.4)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ flex: 1 }} />
      <div style={{ background: "var(--bg)", borderRadius: "22px 22px 0 0", maxHeight: "85%", overflowY: "auto", padding: "18px 18px calc(28px + env(safe-area-inset-bottom))" }}>
        <div style={{ maxWidth: 444, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="disp" style={{ fontSize: 22 }}>{title}</h2>
            <button type="button" className="btn2" onClick={onClose}>Close</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Radio ring used in pick lists: a 7px Ember ring when picked. */
export function Ring({ on }: { on: boolean }) {
  return <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: on ? "7px solid var(--ember)" : "1.5px solid var(--check-line)" }} />;
}

export const linkBtn = { background: "none", border: 0, padding: 0, color: "var(--kingfisher-text)", font: "inherit", fontWeight: 600, cursor: "pointer" } as const;
