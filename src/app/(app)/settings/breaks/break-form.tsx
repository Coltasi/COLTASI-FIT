"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveBreak } from "./actions";
import type { Break } from "@/lib/breaks";

export function BreakForm({ editing }: { editing: Break | null }) {
  const [state, action, pending] = useActionState(saveBreak, { error: null });
  const [perWeek, setPerWeek] = useState(editing?.workouts_per_week ?? 3);
  const step = (d: number) => setPerWeek((n) => Math.min(7, Math.max(1, n + d)));

  return (
    <form action={action} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, ...(editing ? { border: "2px solid var(--ember)" } : {}) }}>
      <h2 className="sec">{editing ? "Edit break" : "Add a break"}</h2>
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <input type="hidden" name="workouts_per_week" value={perWeek} />

      <div>
        <label className="flab" htmlFor="brk-name">Name (optional)</label>
        <input id="brk-name" name="name" className="fld" placeholder="e.g. Christmas" defaultValue={editing?.name ?? ""} maxLength={60} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        <div>
          <label className="flab" htmlFor="brk-start">Start</label>
          <input id="brk-start" name="start_date" type="date" required className="fld" defaultValue={editing?.start_date ?? ""} style={{ padding: "0 10px" }} />
        </div>
        <div>
          <label className="flab" htmlFor="brk-end">End</label>
          <input id="brk-end" name="end_date" type="date" required className="fld" defaultValue={editing?.end_date ?? ""} style={{ padding: "0 10px" }} />
        </div>
      </div>

      <div>
        <p className="flab" id="brk-pw">Workouts per week</p>
        <div role="group" aria-labelledby="brk-pw" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--field)", borderRadius: 12, padding: 6 }}>
          <button type="button" aria-label="Fewer workouts" onClick={() => step(-1)} disabled={perWeek <= 1}
            style={{ width: 56, height: 48, borderRadius: 10, border: 0, background: "#fff", fontSize: 24, fontWeight: 700, color: "var(--rust)", cursor: "pointer", opacity: perWeek <= 1 ? 0.4 : 1 }}>−</button>
          <span className="num" aria-live="polite" style={{ fontSize: 28 }}>{perWeek}</span>
          <button type="button" aria-label="More workouts" onClick={() => step(1)} disabled={perWeek >= 7}
            style={{ width: 56, height: 48, borderRadius: 10, border: 0, background: "#fff", fontSize: 24, fontWeight: 700, color: "var(--rust)", cursor: "pointer", opacity: perWeek >= 7 ? 0.4 : 1 }}>+</button>
        </div>
      </div>

      {state.error ? <p style={{ color: "var(--crimson)", fontSize: 16, fontWeight: 600 }}>{state.error}</p> : null}

      <button type="submit" className="btn" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save break"}</button>
      {editing ? <Link prefetch={false} href="/settings/breaks" className="ghost">Cancel</Link> : null}
    </form>
  );
}
