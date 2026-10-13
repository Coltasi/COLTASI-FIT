"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { saveSleep } from "./sleep/actions";
import { MOODS } from "./sleep/sleep-form";
import { fmtDow } from "@/lib/dates";

/** Overview sleep card: last night's hours, the 7-night bars, and an inline form to log or edit. */
export function SleepCard({ night, logged, bars }: {
  night: string;
  logged: { hours: number; wake_feeling: string | null; flags: string[]; note: string | null } | null;
  bars: { night: string; hours: number | null }[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveSleep, { error: null as string | null });
  const [hours, setHours] = useState(logged?.hours ?? 7.5);
  const [mood, setMood] = useState(logged?.wake_feeling ?? "");
  const step = (d: number) => setHours((h) => Math.min(14, Math.max(0, Math.round((h + d) * 2) / 2)));
  const maxH = Math.max(9, ...bars.map((b) => b.hours ?? 0));

  if (editing) {
    return (
      <form action={action} className="card" style={{ padding: "14px 16px", border: "2px solid var(--lagoon)", display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="hidden" name="night_of" value={night} />
        <input type="hidden" name="hours" value={hours} />
        <input type="hidden" name="wake_feeling" value={mood} />
        {(logged?.flags ?? []).map((f) => <input key={f} type="hidden" name="flags" value={f} />)}
        {logged?.note ? <input type="hidden" name="note" value={logged.note} /> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab" style={{ color: "var(--kingfisher-text)" }}>Log last night&apos;s sleep</p>
          <p className="cap" style={{ fontSize: 12 }}>{fmtDow(night)} night</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" aria-label="Less sleep" onClick={() => step(-0.5)} style={stepper}>−</button>
          <div style={{ textAlign: "center" }}>
            <span className="disp" style={{ fontSize: 44, lineHeight: 1 }}>{hours.toFixed(1)}</span>
            <p className="cap" style={{ fontWeight: 600 }}>hours asleep</p>
          </div>
          <button type="button" aria-label="More sleep" onClick={() => step(0.5)} style={stepper}>+</button>
        </div>
        <div>
          <p className="ln" style={{ marginBottom: 8 }}>How did you wake up?</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 6 }}>
            {MOODS.map((m) => {
              const on = mood === m.v;
              return (
                <button key={m.v} type="button" aria-pressed={on} onClick={() => setMood(on ? "" : m.v)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 2px", borderRadius: 12, cursor: "pointer", fontSize: 10.5, fontWeight: 600, color: "var(--navy)", border: on ? "2px solid var(--navy)" : "1px solid var(--line-strong)", background: on ? "var(--cream)" : "#fff" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: m.c }} />{m.l}
                </button>
              );
            })}
          </div>
        </div>
        {state.error ? <p className="err">{state.error}</p> : null}
        <button type="submit" className="btn" style={{ height: 48, fontSize: 15, boxShadow: "none" }} disabled={pending}>{pending ? "Saving…" : "Save sleep"}</button>
      </form>
    );
  }

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p className="lab">Sleep · last night</p>
          {logged ? (
            <p style={{ marginTop: 4 }}>
              <span className="num" style={{ fontSize: 22 }}>{logged.hours.toFixed(1)}</span>{" "}
              <span className="cap">hrs{logged.wake_feeling ? ` · woke ${logged.wake_feeling}` : ""}</span>
            </p>
          ) : <p className="cap" style={{ marginTop: 4 }}>Not logged yet</p>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 36, width: 112 }} aria-label="Last 7 nights">
          {bars.map((b) => (
            <div key={b.night} title={fmtDow(b.night)}
              style={{ flex: 1, borderRadius: 4, height: b.hours ? `${Math.max(12, (b.hours / maxH) * 100)}%` : "12%", background: b.hours == null ? "var(--line-soft)" : b.night === night ? "var(--lagoon)" : "#D4EEF5" }} />
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", marginTop: 6 }}>
        <button type="button" onClick={() => setEditing(true)}
          style={{ background: "none", border: 0, padding: 0, color: "var(--kingfisher-text)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {logged ? "Edit sleep" : "Log sleep"}
        </button>
      </div>
    </div>
  );
}

const stepper: CSSProperties = {
  width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--line-strong)", background: "var(--bg)",
  fontSize: 24, fontWeight: 600, color: "var(--navy)", cursor: "pointer",
};
