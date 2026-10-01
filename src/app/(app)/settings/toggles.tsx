"use client";

import { useOptimistic, useTransition } from "react";
import { setPref } from "./actions";
import type { Units } from "@/lib/units";

export function PrefToggle({ field, on, label }: { field: "notify_weigh_in" | "notify_workout"; on: boolean; label: string }) {
  const [v, setV] = useOptimistic(on);
  const [, start] = useTransition();
  return (
    <button type="button" className={`sw${v ? " on" : ""}`} aria-pressed={v} aria-label={label}
      onClick={() => start(async () => { setV(!v); await setPref(field, !v); })}>
      <span />
    </button>
  );
}

export function UnitsToggle({ units }: { units: Units }) {
  const [v, setV] = useOptimistic(units);
  const [, start] = useTransition();
  return (
    <div className="segc" role="group" aria-label="Units" style={{ width: 180, borderRadius: 10, padding: 3, gap: 3 }}>
      {(["imperial", "metric"] as const).map((u) => (
        <button key={u} type="button" aria-pressed={v === u} className={v === u ? "on" : ""} style={{ height: 32, fontSize: 13, borderRadius: 8 }}
          onClick={() => start(async () => { setV(u); await setPref("units", u); })}>
          {u === "imperial" ? "Imperial" : "Metric"}
        </button>
      ))}
    </div>
  );
}
