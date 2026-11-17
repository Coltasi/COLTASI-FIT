"use client";

import Link from "next/link";
import { useState } from "react";
import { StepsForm } from "./steps/steps-form";
import { fmtDow } from "@/lib/dates";
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
      <div className="card" style={{ padding: "14px 16px", border: "2px solid var(--lagoon)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab" style={{ color: "var(--kingfisher-text)" }}>Log steps</p>
          <button type="button" onClick={() => setEditing(false)} style={linkBtn}>Cancel</button>
        </div>
        <StepsForm
          next="/"
          initialDay={today}
          days={[{ day: today, label: "Today", steps: todaySteps }, { day: yesterday.day, label: "Yesterday", steps: yesterday.steps }]}
        />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p className="lab">Steps · today</p>
          {todaySteps != null ? (
            <p style={{ marginTop: 4 }}>
              <span className="num" style={{ fontSize: 22 }}>{fmtSteps(todaySteps)}</span>{" "}
              <span className="cap">{avg7 != null ? `· 7-day avg ${fmtSteps(avg7)}` : ""}</span>
            </p>
          ) : <p className="cap" style={{ marginTop: 4 }}>{avg7 != null ? `Not logged yet · 7-day avg ${fmtSteps(avg7)}` : "Not logged yet"}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 36, width: 112 }} aria-label="Last 7 days of steps">
          {bars.map((b) => (
            <div key={b.day} title={`${fmtDow(b.day)}${b.steps != null ? ` ${fmtSteps(b.steps)}` : ""}`}
              style={{ flex: 1, borderRadius: 4, height: b.steps ? `${Math.max(12, (b.steps / maxS) * 100)}%` : "12%", background: b.steps == null ? "var(--line-soft)" : b.day === today ? "var(--lagoon)" : "#D4EEF5" }} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <Link href="/steps" style={{ fontSize: 13, fontWeight: 600 }}>History</Link>
        <button type="button" onClick={() => setEditing(true)} style={linkBtn}>{todaySteps != null ? "Edit steps" : "Log steps"}</button>
      </div>
    </div>
  );
}

const linkBtn = { background: "none", border: 0, padding: 0, color: "var(--kingfisher-text)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" } as const;
