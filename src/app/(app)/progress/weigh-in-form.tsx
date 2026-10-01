"use client";

import { useActionState } from "react";
import { logWeighIn, type FormState } from "./actions";
import { toKg, unit, type Units } from "@/lib/units";

export function WeighInForm({ units, today, placeholder, due, label }: {
  units: Units; today: string; placeholder: string; due: boolean; label: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const raw = Number(String(fd.get("weight") ?? "").replace(",", "."));
    if (raw) fd.set("weight_kg", String(toKg(raw, units)));
    return logWeighIn(prev, fd);
  }, { error: null });

  return (
    <form action={action} className="card" style={{ padding: "14px 16px", border: due ? "2px solid var(--ember)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="lab" style={{ color: due ? "var(--rust)" : undefined }}>Weekly weigh-in</p>
        <p className="cap" style={{ fontSize: 12 }}>{label}</p>
      </div>
      <p className="cap" style={{ marginTop: 4 }}>Monday morning, after the bathroom, before food.</p>
      <input type="hidden" name="measured_on" value={today} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <label style={{ flexGrow: 1, position: "relative", display: "block" }}>
          <span className="sr-only">Weight in {unit(units)}</span>
          <input name="weight" inputMode="decimal" placeholder={placeholder} className="fld num"
            style={{ background: "var(--field)", fontSize: 20, paddingRight: 44 }} />
          <span className="cap" style={{ position: "absolute", right: 14, top: 15, fontWeight: 600 }}>{unit(units)}</span>
        </label>
        <button type="submit" className="btn small" style={{ height: 48 }} disabled={pending}>{pending ? "…" : "Log"}</button>
      </div>
      {state.error ? <p className="err" style={{ marginTop: 8 }}>{state.error}</p> : null}
      {state.ok ? <p className="cap" style={{ marginTop: 8, color: "var(--kingfisher-text)", fontWeight: 600 }}>Logged. Coach is writing your read.</p> : null}
    </form>
  );
}
