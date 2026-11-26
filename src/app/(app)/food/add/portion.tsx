"use client";

import { useEffect, useRef } from "react";
import { CoachMark } from "@/components/ui";
import { FRACTIONS, fractionLabel, macroLine, scale, type Label } from "@/lib/portion";

/** A food being logged: the label's numbers (as typed) and how much of it was eaten. */
export type Draft = {
  name: string; kcal: string; protein: string; carbs: string; fat: string;
  /** "100g": numbers are per 100 g (or `baseG` g) and you eat grams. "pack": numbers are for one pack or serving. */
  per: "100g" | "pack";
  /** Grams the numbers are for in "100g" mode, when a saved food uses something other than 100. */
  baseG?: number | null;
  packG: string;
  /** Grams in "100g" mode, packs/servings in "pack" mode. */
  amount: string;
  source: "manual" | "photo" | "text" | "barcode" | "saved";
  note?: string | null;
  /** Set when logging from a saved food: its label is fixed, only the amount changes. */
  savedId?: string;
};

const num = (v: string) => {
  const n = Number(v.replace(",", ".").trim());
  return v.trim() && Number.isFinite(n) ? n : null;
};

/** The label as numbers, or null until calories are filled in. */
export function draftLabel(d: Draft): Label | null {
  const kcal = num(d.kcal);
  if (kcal == null) return null;
  const pack = num(d.packG);
  return {
    kcal, protein_g: num(d.protein) ?? 0, carbs_g: num(d.carbs), fat_g: num(d.fat),
    baseG: d.per === "100g" ? (d.baseG ?? 100) : null,
    packG: pack && pack > 0 ? pack : null,
  };
}

export function draftAmount(d: Draft) {
  const a = num(d.amount);
  return a && a > 0 && a <= 5000 ? a : null;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function Portion({ draft: d, onChange, saveIt, onSaveIt, busy, onSubmit }: {
  draft: Draft; onChange: (d: Draft) => void; saveIt: boolean; onSaveIt: (v: boolean) => void; busy: boolean; onSubmit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Draft>) => onChange({ ...d, ...patch });
  const label = draftLabel(d);
  const amount = draftAmount(d);
  const eaten = label && amount ? scale(label, amount) : null;
  const pack = num(d.packG);
  const base = d.baseG ?? 100;
  const saved = !!d.savedId;
  const grams = d.per === "100g";

  // Saved foods are tapped at the top of the screen: bring this panel into view.
  const key = d.savedId ?? d.source;
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [key]);

  /** Quick picks: parts of the pack in grams mode (needs the pack weight), otherwise parts of a pack/serving. */
  const picks = grams
    ? (pack ? FRACTIONS.filter((f) => f.v <= 1).map((f) => ({ l: f.v === 1 ? "All" : f.l, v: Math.round(pack * f.v) })) : [])
    : FRACTIONS.map((f) => ({ l: f.l, v: f.v }));
  const picked = (v: number) => amount != null && Math.abs(amount - v) < (grams ? 0.5 : 0.005);

  return (
    <div ref={ref} className="card" style={{ padding: 16, display: "grid", gap: 14, border: "2px solid var(--lagoon)", scrollMarginTop: 16 }}>
      {d.source === "photo" || d.source === "text" ? (
        <p style={{ fontSize: 15, display: "flex", gap: 8, alignItems: "flex-start" }}><CoachMark size={18} /><span>Estimate{d.note ? `: ${d.note}` : ""}. Adjust if it looks off.</span></p>
      ) : null}

      {saved ? (
        <div>
          <p className="ln" style={{ fontSize: 17 }}>{d.name}</p>
          <p className="cap" style={{ fontSize: 14 }}>
            {label ? `${macroLine({ ...label })} · ${label.kcal} kcal ${grams ? `per ${fmt(base)} g` : "per pack"}` : ""}
          </p>
        </div>
      ) : (
        <>
          <label style={{ display: "block" }}>
            <span className="flab">Name</span>
            <input className="fld" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Turkey slices" />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <span className="flab" style={{ margin: 0 }}>Nutrition on the label</span>
            <div className="segc" role="group" aria-label="Label numbers are for">
              <button type="button" className={grams ? "on" : ""} aria-pressed={grams}
                onClick={() => { if (!grams) set({ per: "100g", amount: pack ? fmt(pack) : "" }); }}>Per 100 g</button>
              <button type="button" className={!grams ? "on" : ""} aria-pressed={!grams}
                onClick={() => { if (grams) set({ per: "pack", amount: "1" }); }}>Per pack or serving</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
              <Num label="Calories" value={d.kcal} onChange={(v) => set({ kcal: v })} numeric />
              <Num label="Protein (g)" value={d.protein} onChange={(v) => set({ protein: v })} />
              <Num label="Carbs (g)" value={d.carbs} onChange={(v) => set({ carbs: v })} />
              <Num label="Fat (g)" value={d.fat} onChange={(v) => set({ fat: v })} />
            </div>
            {grams ? (
              <Num label="Pack size (g), for quick picks" value={d.packG} onChange={(v) => set({ packG: v })} />
            ) : null}
          </div>
        </>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <span className="flab" style={{ margin: 0 }}>How much did you have?</span>
        {grams ? (
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input className="fld" inputMode="decimal" aria-label="Grams eaten" value={d.amount} onChange={(e) => set({ amount: e.target.value })} style={{ width: 120 }} />
            <span className="ln">g</span>
          </label>
        ) : null}
        {picks.length ? (
          <>
            {grams ? <span className="cap" style={{ fontSize: 14 }}>Or part of the {fmt(pack!)} g pack</span> : null}
            <div role="group" aria-label={grams ? "Part of the pack" : "Packs or servings"}
              style={{ display: "grid", gridTemplateColumns: `repeat(${grams ? picks.length : 4}, minmax(0, 1fr))`, gap: 8 }}>
              {picks.map((p) => (
                <button key={p.l} type="button" className={`chip${picked(p.v) ? " on" : ""}`} aria-pressed={picked(p.v)}
                  style={{ justifyContent: "center", padding: 0, fontSize: 17 }} onClick={() => set({ amount: String(p.v) })}>{p.l}</button>
              ))}
            </div>
          </>
        ) : grams && !saved ? <span className="cap" style={{ fontSize: 14 }}>Add the pack size above to pick ⅓, ½ and so on.</span> : null}
      </div>

      <div role="status" style={{ background: "var(--tint-neutral)", borderRadius: 12, padding: "12px 14px" }}>
        {eaten ? (
          <>
            <p style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <span className="ln">You had {grams ? `${fmt(amount!)} g` : `${fractionLabel(amount!)} ${amount! > 1 ? "packs" : "pack"}`}</span>
              <span className="num" style={{ fontSize: 20, fontWeight: 800 }}>{eaten.kcal} kcal</span>
            </p>
            <p className="cap" style={{ marginTop: 2 }}>{macroLine(eaten)}</p>
          </>
        ) : (
          <p className="cap">{label ? "Enter how much you had to see the totals." : "Fill in the calories to see the totals."}</p>
        )}
      </div>

      {saved ? null : (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }}>
          <input type="checkbox" checked={saveIt} onChange={(e) => onSaveIt(e.target.checked)} style={{ width: 20, height: 20 }} />
          Save for next time
        </label>
      )}
      <button type="button" className="btn" style={{ height: 50, boxShadow: "none" }} disabled={busy} onClick={onSubmit}>
        {busy ? "Logging…" : "Log it"}
      </button>
    </div>
  );
}

function Num({ label, value, onChange, numeric }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <label style={{ display: "block" }}>
      <span className="flab" style={{ fontSize: 14 }}>{label}</span>
      <input className="fld" inputMode={numeric ? "numeric" : "decimal"} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
