"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { saveSleep } from "./actions";

const MOODS = [
  { v: "energetic", l: "Energetic", c: "var(--lagoon)" },
  { v: "rested", l: "Rested", c: "var(--kingfisher)" },
  { v: "groggy", l: "Groggy", c: "var(--mist)" },
  { v: "tired", l: "Tired", c: "var(--ember)" },
  { v: "exhausted", l: "Exhausted", c: "var(--rust)" },
];
const FLAGS = [
  { v: "interrupted", l: "Interrupted" }, { v: "woke_early", l: "Woke early" }, { v: "restless", l: "Restless" },
  { v: "nightmares", l: "Nightmares" }, { v: "good_dreams", l: "Good dreams" }, { v: "slept_through", l: "Slept through" },
];

export function SleepForm({ night, initial }: {
  night: string;
  initial: { hours: number; wake_feeling: string | null; flags: string[]; note: string } | null;
}) {
  const [state, action, pending] = useActionState(saveSleep, { error: null as string | null });
  const [hours, setHours] = useState(initial?.hours ?? 7.5);
  const [mood, setMood] = useState(initial?.wake_feeling ?? "");
  const [flags, setFlags] = useState<string[]>(initial?.flags ?? []);
  const step = (d: number) => setHours((h) => Math.min(14, Math.max(0, Math.round((h + d) * 2) / 2)));

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <input type="hidden" name="night_of" value={night} />
      <input type="hidden" name="hours" value={hours} />
      <input type="hidden" name="wake_feeling" value={mood} />
      {flags.map((f) => <input key={f} type="hidden" name="flags" value={f} />)}

      <div className="card" style={{ padding: "18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" aria-label="Less sleep" onClick={() => step(-0.5)} style={stepper}>−</button>
        <div style={{ textAlign: "center" }}>
          <span className="disp" style={{ fontSize: 48, lineHeight: 1 }}>{hours.toFixed(1)}</span>
          <p className="cap" style={{ fontWeight: 600 }}>hours asleep</p>
        </div>
        <button type="button" aria-label="More sleep" onClick={() => step(0.5)} style={stepper}>+</button>
      </div>

      <div>
        <p className="ln" style={{ marginBottom: 10 }}>How did you wake up?</p>
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

      <div>
        <p className="ln" style={{ marginBottom: 2 }}>Anything unusual?</p>
        <p className="cap" style={{ marginBottom: 10 }}>Pick any. Coach factors these in.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FLAGS.map((f) => {
            const on = flags.includes(f.v);
            return (
              <button key={f.v} type="button" aria-pressed={on} className={`chip${on ? " on" : ""}`}
                onClick={() => setFlags(on ? flags.filter((x) => x !== f.v) : [...flags, f.v])}>{f.l}</button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "block" }}>
        <span className="ln" style={{ display: "block", marginBottom: 2 }}>Anything else for Coach?</span>
        <span className="cap" style={{ display: "block", marginBottom: 10 }}>Optional</span>
        <textarea name="note" className="fld" defaultValue={initial?.note ?? ""} placeholder="Room was too warm, late work call…" />
      </label>
      {state.error ? <p className="err">{state.error}</p> : null}
      <div className="dock"><div><button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save sleep"}</button></div></div>
    </form>
  );
}

const stepper: CSSProperties = {
  width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--line-strong)", background: "var(--bg)",
  fontSize: 24, fontWeight: 600, color: "var(--navy)", cursor: "pointer",
};
