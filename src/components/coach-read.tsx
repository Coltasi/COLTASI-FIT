"use client";

import { useState, type ReactNode } from "react";
import { IconDown } from "./icons";
import { PARTS, ReadText, type ReadParts } from "./coach-read-parts";
import { CoachPlan, type PlanSignals } from "./coach-plan";
import type { Units } from "@/lib/units";
import { headline, points } from "@/lib/points";

export { points };

export { PARTS, ReadText, type ReadParts };

/**
 * Coach card. The default is the cream card; `feature` renders the navy daily briefing:
 * the first point is always visible as the headline, the rest of the notes sit behind a tap.
 */
export function CoachRead({ label, read, footer, lead, pep, units = "metric", defaultOpen = false, padding = "16px 16px 6px", collapsible = false, feature = false }: {
  label: ReactNode; read: ReadParts & { signals?: PlanSignals | null }; footer?: ReactNode; lead?: ReactNode; units?: Units; defaultOpen?: boolean; padding?: string;
  /** When set, the Coach's notes sit behind a tap on the label; the footer stays visible. */
  collapsible?: boolean;
  feature?: boolean;
  /** Today screen: the Coach's pep talk leads the card; the read's own headline moves into the notes. */
  pep?: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [notesOpen, setNotesOpen] = useState(false);
  const plan = read.signals?.sleep && Array.isArray(read.signals.lifts) ? read.signals : null;
  const parts = plan ? [] : PARTS.filter(([, k]) => read[k]);
  const pts = points(read.headline);

  if (feature) {
    const h = headline(read.headline);
    const head = pep?.length ? pep[0] : h.head;
    const rest = pep?.length ? [h.head, ...h.rest].filter((x): x is string => !!x) : h.rest;
    const more = rest.length > 0 || !!lead || parts.length > 0 || !!plan;
    return (
      <section className="feature" aria-label="Coach briefing">
        {label}
        {head ? <p className="feature-title" style={{ fontSize: 22 }}>{head}</p> : null}
        {pep?.[1] ? <p style={{ fontSize: 17, lineHeight: 1.45, color: "var(--on-navy)" }}>{pep[1]}</p> : null}
        {more ? (
          <button type="button" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen}
            className="pill" style={{ alignSelf: "flex-start" }}>
            {notesOpen ? "Hide coaching notes" : "Coaching notes"}
            <IconDown style={{ transition: "transform .15s", transform: notesOpen ? "rotate(180deg)" : "none" }} />
          </button>
        ) : null}
        {notesOpen ? (
          <div className="card" style={{ padding: "6px 16px 8px" }}>
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 8px", display: "flex", flexDirection: "column", gap: 10 }}>
              {lead ? <li style={bullet}><span style={dot} /><div style={{ minWidth: 0 }}>{lead}</div></li> : null}
              {rest.map((t, i) => <li key={i} style={bullet}><span style={dot} /><span>{t}</span></li>)}
            </ul>
            {parts.length || plan ? (
              <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                className="pill" style={{ alignSelf: "flex-start" }}>
                {open ? "Hide the plan" : "Next session plan"}
                <IconDown style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
              </button>
            ) : null}
            {open && plan ? <CoachPlan s={plan} weight={read.weight} units={units} /> : null}
            {open ? parts.map(([l, k, c]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 10, padding: "10px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 5, background: c }} />
                <div><p style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{l}</p><ReadText text={read[k] as string} /></div>
              </div>
            )) : null}
          </div>
        ) : null}
        {footer}
      </section>
    );
  }

  const showNotes = !collapsible || notesOpen;
  return (
    <div className="card cream" style={{ padding }}>
      {collapsible ? (
        <button type="button" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: 0, padding: "2px 0 10px", cursor: "pointer", color: "var(--navy)", textAlign: "left" }}>
          {label}
          <span className="pill">
            {notesOpen ? "Hide" : "Coaching"}
            <IconDown style={{ transition: "transform .15s", transform: notesOpen ? "rotate(180deg)" : "none" }} />
          </span>
        </button>
      ) : label}
      {showNotes ? <>
      <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 8px", display: "flex", flexDirection: "column", gap: 8, color: "var(--navy)" }}>
        {lead ? <li style={bullet}><span style={dot} /><div style={{ minWidth: 0 }}>{lead}</div></li> : null}
        {pts.map((t, i) => <li key={i} style={bullet}><span style={dot} /><span>{t}</span></li>)}
      </ul>
      {parts.length || plan ? (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="pill" style={{ alignSelf: "flex-start" }}>
          {open ? "Hide the plan" : "Next session plan"}
          <IconDown style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
        </button>
      ) : null}
      {open && plan ? <CoachPlan s={plan} weight={read.weight} units={units} /> : null}
      {open ? parts.map(([l, k, c]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 10, padding: "10px 0", borderTop: "1px solid #ead8cb" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 5, background: c }} />
          <div><p style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{l}</p><ReadText text={read[k] as string} /></div>
        </div>
      )) : null}
      </> : null}
      {footer}
    </div>
  );
}

const bullet = { display: "grid", gridTemplateColumns: "8px minmax(0,1fr)", gap: 10, alignItems: "start", fontSize: 16, fontWeight: 500, lineHeight: 1.45, color: "var(--navy)" } as const;
const dot = { width: 6, height: 6, borderRadius: "50%", background: "var(--kingfisher)", marginTop: 8 } as const;

/** A card whose header row toggles the rows below it. Collapsed by default. */
export function Disclosure({ title, summary, openSummary, children }: { title: string; summary: ReactNode; openSummary?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card clip">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", minHeight: 56, background: "none", border: 0, cursor: "pointer", color: "var(--navy)", textAlign: "left" }}>
        <span className="ln">{title}</span>
        <span className="cap" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{open ? openSummary ?? summary : summary}</span>
          <IconDown style={{ flexShrink: 0, color: "var(--stone)", transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}
