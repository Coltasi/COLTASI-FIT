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
      <div className="card" style={{ gridColumn: "1 / -1", padding: "14px 16px", border: "2px solid var(--kingfisher)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="ln">Log steps</p>
          <span style={{ display: "flex", gap: 8 }}>
            <Link prefetch={false} href="/steps" className="pill">History</Link>
            <button type="button" onClick={() => setEditing(false)} className="pill">Cancel</button>
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

  // Compact tile: tap anywhere to log or edit. Missing data is an action, not a dash.
  return (
    <button type="button" onClick={() => setEditing(true)} className="tile" aria-label={todaySteps != null ? "Edit steps" : "Log steps"} style={{ cursor: "pointer" }}>
      <span className="lab">Steps</span>
      {todaySteps != null
        ? <span className="big">{fmtSteps(todaySteps)}</span>
        : <span className="big" style={{ color: "var(--rust)", fontSize: 24 }}>Log steps +</span>}
      <span className="cap">{avg7 != null ? `${fmtSteps(avg7)} daily avg.` : "Today"}</span>
      <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18, marginTop: 10 }} aria-hidden>
        {bars.map((b) => (
          <span key={b.day} style={{ flex: 1, borderRadius: 2, height: b.steps ? `${Math.max(15, (b.steps / maxS) * 100)}%` : "15%", background: b.steps == null ? "var(--line-soft)" : b.day === today ? "var(--kingfisher)" : "#bfe0ea" }} />
        ))}
      </span>
    </button>
  );
}

