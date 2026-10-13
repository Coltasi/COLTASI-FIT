"use client";

import { useState, type ReactNode } from "react";
import { IconDown } from "./icons";

const PARTS = [
  ["Lifting", "lifting", "var(--kingfisher)"],
  ["Weight & diet", "weight", "var(--ember)"],
  ["Recovery", "recovery", "var(--lagoon)"],
] as const;

export type ReadParts = { headline: string; lifting: string | null; weight: string | null; recovery: string | null };

/** Cream Coach card whose headline collapses and expands the full read. Collapsed by default. */
export function CoachRead({ label, read, footer, padding = "16px 16px 6px" }: {
  label: ReactNode; read: ReadParts; footer?: ReactNode; padding?: string;
}) {
  const [open, setOpen] = useState(false);
  const parts = PARTS.filter(([, k]) => read[k]);
  return (
    <div className="card cream" style={{ padding }}>
      {label}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Hide full read" : "Show full read"}
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, width: "100%", background: "none", border: 0, padding: 0, margin: "8px 0 6px", textAlign: "left", cursor: "pointer", color: "var(--navy)" }}>
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{read.headline}</span>
        {parts.length ? <IconDown style={{ flexShrink: 0, marginTop: 3, color: "var(--stone)", transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} /> : null}
      </button>
      {open ? parts.map(([l, k, c]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 10, padding: "10px 0", borderTop: "1px solid #e6dcc0" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 5, background: c }} />
          <div><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{l}</p><p style={{ fontSize: 14, lineHeight: 1.45 }}>{read[k]}</p></div>
        </div>
      )) : null}
      {footer}
    </div>
  );
}

/** A card whose header row toggles the rows below it. Collapsed by default. */
export function Disclosure({ title, summary, openSummary, children }: { title: string; summary: ReactNode; openSummary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card clip">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", background: "none", border: 0, cursor: "pointer", color: "var(--navy)", textAlign: "left" }}>
        <span className="lab">{title}</span>
        <span className="cap" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{open ? openSummary ?? summary : summary}</span>
          <IconDown style={{ flexShrink: 0, color: "var(--stone)", transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}
