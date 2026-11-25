"use client";

import { WARMUP_MINS } from "@/lib/warmup";

/** Warm-up length in 5 minute steps. */
export function WarmupLength({ value, onChange }: { value: number; onChange: (min: number) => void }) {
  return (
    <div role="group" aria-label="Warm-up length" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {WARMUP_MINS.map((m) => (
        <button key={m} type="button" className={`chip${value === m ? " on" : ""}`} aria-pressed={value === m}
          style={{ justifyContent: "center" }} onClick={() => onChange(m)}>{m} min</button>
      ))}
    </div>
  );
}
