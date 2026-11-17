"use client";

import { useActionState, useState } from "react";
import { saveSteps } from "./actions";

/** Day picker + step count. `days` lists the selectable days with any steps already logged. */
export function StepsForm({ days, initialDay, next }: {
  days: { day: string; label: string; steps: number | null }[];
  initialDay: string;
  next: "/" | "/steps";
}) {
  const [state, action, pending] = useActionState(saveSteps, { error: null as string | null });
  const [day, setDay] = useState(initialDay);
  const existing = (d: string) => days.find((x) => x.day === d)?.steps ?? null;
  const [value, setValue] = useState(existing(initialDay)?.toString() ?? "");

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="day" value={day} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {days.map((d) => (
          <button key={d.day} type="button" aria-pressed={day === d.day} className={`chip${day === d.day ? " on" : ""}`}
            onClick={() => { setDay(d.day); setValue(existing(d.day)?.toString() ?? ""); }}>{d.label}</button>
        ))}
      </div>
      <input name="steps" className="fld" type="number" inputMode="numeric" min={0} max={200000} step={1} required
        placeholder="Steps from your Garmin" value={value} onChange={(e) => setValue(e.target.value)} />
      {state.error ? <p className="err">{state.error}</p> : null}
      <button type="submit" className="btn" style={{ height: 48, fontSize: 15, boxShadow: "none" }} disabled={pending}>
        {pending ? "Saving…" : existing(day) != null ? "Update steps" : "Save steps"}
      </button>
    </form>
  );
}
