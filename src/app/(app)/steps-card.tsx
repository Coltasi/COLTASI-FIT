"use client";

import Link from "next/link";
import { useState } from "react";
import { StepsForm } from "./steps/steps-form";
import { fmtSteps } from "@/lib/steps";

/** Overview steps card: today's count, 7-day bars and average, and an inline form to log or edit. */
export function StepsCard({ today, bars, avg7 }: {
  today: string;
  bars: { day: string; steps: number | null }[]; // last 7 days, oldest first, ends with today
  avg7: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const todaySteps = bars.find((b) => b.day === today)?.steps ?? null;
  const maxS = Math.max(8000, ...bars.map((b) => b.steps ?? 0));
  const yesterday = bars.at(-2)!;

  if (editing) {
    return (
      <div className="card" style={{ gridColumn: "1 / -1", padding: "14px 16px", border: "2px solid var(--lagoon)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab" style={{ color: "var(--ember-text)" }}>Log steps</p>
          <span style={{ display: "flex", gap: 14 }}>
            <Link href="/steps" style={{ fontSize: 14, fontWeight: 600 }}>History</Link>
            <button type="button" onClick={() => setEditing(false)} style={linkBtn}>Cancel</button>
          </span>
        </div>
        <StepsForm
          next="/"
          initialDay={today}
          days={[{ day: today, label: "Today", steps: todaySteps }, { day: yesterday.day, label: "Yesterday", steps: yesterday.steps }]}
        />
      </div>
    );
  }

  // Compact tile: tap anywhere to log or edit.
  return (
    <button type="button" onClick={() => setEditing(true)} className="card" aria-label={todaySteps != null ? "Edit steps" : "Log steps"}
      style={{ padding: "16px 16px", textAlign: "left", cursor: "pointer", font: "inherit", color: "var(--navy)", display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="lab">Steps</span>
      {todaySteps != null ? (
        <span className="num" style={{ fontSize: 22, marginTop: 2 }}>{fmtSteps(todaySteps)}</span>
      ) : (
        <span className="num" style={{ fontSize: 22, marginTop: 2, color: "var(--muted)" }}>–</span>
      )}
      {todaySteps != null || avg7 == null
        ? <span className="cap" style={{ fontSize: 14 }}>{avg7 != null ? `Avg ${fmtSteps(avg7)}` : "Today"}</span>
        : <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ember-text)" }}>Log today · avg {fmtSteps(avg7)}</span>}
      <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18, marginTop: 6 }} aria-hidden>
        {bars.map((b) => (
          <span key={b.day} style={{ flex: 1, borderRadius: 2, height: b.steps ? `${Math.max(15, (b.steps / maxS) * 100)}%` : "15%", background: b.steps == null ? "var(--line-soft)" : b.day === today ? "var(--lagoon)" : "#D4EEF5" }} />
        ))}
      </span>
    </button>
  );
}

const linkBtn = { background: "none", border: 0, padding: 0, color: "var(--ember-text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" } as const;
