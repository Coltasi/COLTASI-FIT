"use client";

import { useActionState } from "react";
import type { Profile } from "@/lib/data";
import { saveProfile } from "../actions";

function Field({ label, name, value, hint, inputMode = "decimal", placeholder }: {
  label: string; name: string; value: string | number | null | undefined; hint?: string; inputMode?: "decimal" | "numeric" | "text"; placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="flab">{label}</span>
      <input name={name} className="fld" inputMode={inputMode} defaultValue={value ?? ""} placeholder={placeholder} />
      {hint ? <span className="cap" style={{ display: "block", marginTop: 4, fontSize: 12 }}>{hint}</span> : null}
    </label>
  );
}

export function ProfileForm({ profile: p }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, { error: null as string | null });
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <p className="lab">You</p>
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
        <p className="lab">Goal</p>
        <label style={{ display: "block" }}>
          <span className="flab">Phase</span>
          <select name="phase" className="fld" defaultValue={p.phase ?? "cut"}>
            <option value="cut">Cut</option><option value="maintain">Maintain</option><option value="bulk">Bulk</option>
          </select>
        </label>
        <Field label="Target rate (kg per week)" name="target_rate_kg_week" value={p.target_rate_kg_week == null ? "" : Math.abs(Number(p.target_rate_kg_week))} hint="How fast you aim to lose (cut) or gain (bulk). Coach compares your weigh-ins to this." placeholder="0.5" />
      </div>

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <p className="lab">Energy</p>
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
        <p className="lab">Equipment</p>
        <Field label="Kettlebells on hand (kg)" name="kettlebells_kg" value={(p.kettlebells_kg ?? []).join(", ")} inputMode="text" hint="Comma separated, e.g. 8, 12, 16, 20, 24, 30" />
      </div>

      {state.error ? <p className="err">{state.error}</p> : null}
      <div className="dock"><div><button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div></div>
    </form>
  );
}
