"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/data";
import { saveProfile } from "../actions";
import { w, unit, type Units } from "@/lib/units";

function Field({ label, name, value, hint, inputMode = "decimal", placeholder }: {
  label: string; name: string; value: string | number | null | undefined; hint?: string; inputMode?: "decimal" | "numeric" | "text"; placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="flab">{label}</span>
      <input name={name} className="fld" inputMode={inputMode} defaultValue={value ?? ""} placeholder={placeholder} />
      {hint ? <span className="cap" style={{ display: "block", marginTop: 4, fontSize: 15 }}>{hint}</span> : null}
    </label>
  );
}

export type LatestScan = { on: string; weightKg: number; bodyFat: number };

type Option = { id: string; name: string; sub: string; kg: number; rec: boolean };

/** Suggested goals from the latest scan: keep lean mass, change body fat (cut), or add muscle (bulk). */
function suggestions(scan: LatestScan | null, sex: string | null, phase: string, units: Units): Option[] {
  if (!scan || phase === "maintain") return [];
  if (phase === "bulk") {
    return [2, 3, 4].map((g, i) => ({ id: `b${g}`, name: i === 0 ? "Steady" : i === 1 ? "Moderate" : "Ambitious", sub: `Add ${w(g, units)} ${unit(units)} of muscle`, kg: Math.round((scan.weightKg + g) * 10) / 10, rec: i === 0 }));
  }
  const lean = scan.weightKg * (1 - scan.bodyFat / 100);
  const levels = sex === "female" ? [["Lean", 25], ["Athletic", 22], ["Very lean", 20]] : [["Lean", 15], ["Athletic", 12], ["Very lean", 10]];
  const opts = levels
    .filter(([, bf]) => scan.bodyFat > (bf as number) + 0.5)
    .map(([name, bf]) => ({ id: String(bf), name: name as string, sub: `${bf}% body fat`, kg: Math.round((lean / (1 - (bf as number) / 100)) * 10) / 10, rec: false }));
  if (opts[0]) opts[0].rec = true;
  return opts;
}

const fmtScan = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function GoalPicker({ units, scan, sex, phase, initialKg }: { units: Units; scan: LatestScan | null; sex: string | null; phase: string; initialKg: number | null }) {
  const [val, setVal] = useState(initialKg == null ? "" : w(initialKg, units));
  const opts = suggestions(scan, sex, phase, units);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "block" }}>
        <span className="flab">Goal weight ({unit(units)})</span>
        <input name="goal_weight" className="fld" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Type or pick below" />
      </label>
      {opts.length ? (
        <div role="radiogroup" aria-label="Suggested goal weights" style={{ display: "grid", gap: 8 }}>
          <p className="cap" style={{ fontSize: 15 }}>Suggestions from your {fmtScan(scan!.on)} scan</p>
          {opts.map((o) => {
            const shown = w(o.kg, units);
            const on = val === shown;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setVal(shown)}
                style={{ minHeight: 64, boxSizing: "border-box", borderRadius: 12, border: `2px solid ${on ? "var(--rust)" : "var(--line)"}`, background: on ? "var(--tint-ember-soft)" : "var(--surface)",
                  padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textAlign: "left", color: "var(--navy)", cursor: "pointer", font: "inherit" }}>
                <span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700 }}>
                    {o.name}
                    {o.rec ? <span style={{ background: "var(--tint-jade)", color: "#1f6b57", fontSize: 15, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>Recommended</span> : null}
                  </span>
                  <span style={{ display: "block", fontSize: 15, color: "var(--muted)", marginTop: 4 }}>{o.sub}</span>
                </span>
                <span className="num" style={{ fontSize: 22, fontWeight: 800, whiteSpace: "nowrap" }}>{shown} {unit(units)}</span>
              </button>
            );
          })}
        </div>
      ) : !scan && phase !== "maintain" ? (
        <div style={{ background: "var(--tint-ember)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, lineHeight: 1.4 }}>Log a Tanita scan and we&apos;ll suggest a goal.</span>
          <Link prefetch={false} href="/progress/scan" className="btn small" style={{ flexShrink: 0 }}>Log scan</Link>
        </div>
      ) : null}
    </div>
  );
}

export function ProfileForm({ profile: p, scan }: { profile: Profile; scan: LatestScan | null }) {
  const [state, action, pending] = useActionState(saveProfile, { error: null as string | null });
  const [phase, setPhase] = useState(p.phase ?? "cut");
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <p className="ln" style={{ fontSize: 17 }}>You</p>
        <Field label="Name" name="display_name" value={p.display_name} inputMode="text" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
          <Field label="Height (cm)" name="height_cm" value={p.height_cm} />
          <Field label="Birth year" name="birth_year" value={p.birth_year} inputMode="numeric" />
        </div>
        <label style={{ display: "block" }}>
          <span className="flab">Sex</span>
          <select name="sex" className="fld" defaultValue={p.sex ?? ""}>
            <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <p className="ln" style={{ fontSize: 17 }}>Goal</p>
        <label style={{ display: "block" }}>
          <span className="flab">Phase</span>
          <select name="phase" className="fld" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="cut">Cut</option><option value="maintain">Maintain</option><option value="bulk">Bulk</option>
          </select>
        </label>
        <input type="hidden" name="units" value={p.units ?? "metric"} />
        <input type="hidden" name="had_goal" value={p.goal_weight_kg == null ? "0" : "1"} />
        <GoalPicker units={p.units ?? "metric"} scan={scan} sex={p.sex} phase={phase} initialKg={p.goal_weight_kg == null ? null : Number(p.goal_weight_kg)} />
        <input type="hidden" name="had_goal_bf" value={p.goal_body_fat_pct == null ? "0" : "1"} />
        <Field label="Goal body fat (%)" name="goal_body_fat_pct" value={p.goal_body_fat_pct ?? ""} inputMode="decimal" hint="Coach cheers you on toward this." placeholder="15" />
        <Field label="Target rate (kg per week)" name="target_rate_kg_week" value={p.target_rate_kg_week == null ? "" : Math.abs(Number(p.target_rate_kg_week))} hint="How fast you aim to lose (cut) or gain (bulk). Coach compares your weigh-ins to this." placeholder="0.5" />
      </div>

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <p className="ln" style={{ fontSize: 17 }}>Energy</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
          <Field label="TDEE (kcal)" name="tdee_kcal" value={p.tdee_kcal} inputMode="numeric" />
          <Field label="Target (kcal)" name="target_kcal" value={p.target_kcal} inputMode="numeric" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
          <Field label="Protein g" name="protein_g" value={p.protein_g} inputMode="numeric" />
          <Field label="Carbs g" name="carbs_g" value={p.carbs_g} inputMode="numeric" />
          <Field label="Fat g" name="fat_g" value={p.fat_g} inputMode="numeric" />
        </div>
      </div>

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <p className="ln" style={{ fontSize: 17 }}>Equipment</p>
        <Field label="Kettlebells on hand (kg)" name="kettlebells_kg" value={(p.kettlebells_kg ?? []).join(", ")} inputMode="text" hint="Comma separated, e.g. 8, 12, 16, 20, 24, 30" />
      </div>

      {state.error ? <p className="err">{state.error}</p> : null}
      <div className="dock"><div><button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div></div>
    </form>
  );
}
