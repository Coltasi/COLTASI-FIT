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
      <form action={action} className="card" style={{ gridColumn: "1 / -1", padding: "14px 16px", border: "2px solid var(--lagoon)", display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="hidden" name="night_of" value={night} />
        <input type="hidden" name="hours" value={hours} />
        <input type="hidden" name="wake_feeling" value={mood} />
        {(logged?.flags ?? []).map((f) => <input key={f} type="hidden" name="flags" value={f} />)}
        {logged?.note ? <input type="hidden" name="note" value={logged.note} /> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab" style={{ color: "var(--ember-text)" }}>Log last night&apos;s sleep</p>
          <span style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
            <span className="cap" style={{ fontSize: 14 }}>{fmtDow(night)} night</span>
            <button type="button" onClick={() => setEditing(false)} style={{ background: "none", border: 0, padding: 0, color: "var(--ember-text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </span>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 }}>
            {MOODS.map((m) => {
              const on = mood === m.v;
              return (
                <button key={m.v} type="button" aria-pressed={on} onClick={() => setMood(on ? "" : m.v)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 2px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--navy)", border: on ? "2px solid var(--navy)" : "1px solid var(--line-strong)", background: on ? "var(--cream)" : "#fff" }}>
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

  // Compact tile: tap anywhere to log or edit.
  return (
    <button type="button" onClick={() => setEditing(true)} className="card" aria-label={logged ? "Edit sleep" : "Log sleep"}
      style={{ padding: "16px 16px", textAlign: "left", cursor: "pointer", font: "inherit", color: "var(--navy)", display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="lab">Sleep</span>
      {logged ? (
        <>
          <span className="num" style={{ fontSize: 22, marginTop: 2 }}>{logged.hours.toFixed(1)}<span className="cap" style={{ fontSize: 14 }}> h</span></span>
          <span className="cap" style={{ fontSize: 14, textTransform: "capitalize" }}>{logged.wake_feeling ?? "Last night"}</span>
        </>
      ) : (
        <>
          <span className="num" style={{ fontSize: 22, marginTop: 2, color: "var(--muted)" }}>–</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ember-text)" }}>Log last night</span>
        </>
      )}
      <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18, marginTop: 6 }} aria-hidden>
        {bars.map((b) => (
          <span key={b.night} style={{ flex: 1, borderRadius: 2, height: b.hours ? `${Math.max(15, (b.hours / maxH) * 100)}%` : "15%", background: b.hours == null ? "var(--line-soft)" : b.night === night ? "var(--lagoon)" : "#D4EEF5" }} />
        ))}
      </span>
    </button>
  );
}

const stepper: CSSProperties = {
  width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--line-strong)", background: "var(--bg)",
  fontSize: 24, fontWeight: 600, color: "var(--navy)", cursor: "pointer",
};
