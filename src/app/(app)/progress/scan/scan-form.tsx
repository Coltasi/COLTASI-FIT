"use client";

import { useActionState, useState } from "react";
import { logScan, type LogScanState } from "../actions";

const initialState: LogScanState = { error: null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ScanForm() {
  const [state, formAction, pending] = useActionState(logScan, initialState);
  const [previews, setPreviews] = useState<string[]>([]);

  return (
    <form action={formAction}>
      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        Tanita photos
      </p>
      <div className="mb-5 flex gap-2.5 overflow-x-auto">
        {previews.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="border-border h-24 w-[76px] flex-shrink-0 rounded-lg border object-cover"
          />
        ))}
        <label className="border-muted-2 bg-border flex h-24 w-[76px] flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed text-2xl text-[#B8B4AB]">
          +
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPreviews(files.map((f) => URL.createObjectURL(f)));
            }}
          />
        </label>
      </div>

      <label className="mb-4 flex flex-col">
        <span className="text-muted mb-1 text-xs font-bold tracking-wide uppercase">
          Date
        </span>
        <input
          type="date"
          name="scanned_at"
          defaultValue={todayIso()}
          className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col">
          <span className="text-muted mb-1 text-xs">Weight (kg)</span>
          <input
            type="number"
            name="weight_kg"
            step="0.1"
            required
            inputMode="decimal"
            className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Body fat (%)</span>
            <input
              type="number"
              name="body_fat_pct"
              step="0.1"
              inputMode="decimal"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Fat mass (kg)</span>
            <input
              type="number"
              name="fat_mass_kg"
              step="0.1"
              inputMode="decimal"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Muscle mass (kg)</span>
            <input
              type="number"
              name="muscle_mass_kg"
              step="0.1"
              inputMode="decimal"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Water (%)</span>
            <input
              type="number"
              name="water_pct"
              step="0.1"
              inputMode="decimal"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Visceral fat</span>
            <input
              type="number"
              name="visceral_fat_rating"
              step="1"
              inputMode="numeric"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">BMR (kcal)</span>
            <input
              type="number"
              name="bmr_kcal"
              step="1"
              inputMode="numeric"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
        </div>
        <textarea
          name="notes"
          rows={2}
          placeholder="Notes (optional)"
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-sm outline-none focus:border-blue"
        />
      </div>

      <p className="text-muted mt-4 mb-2 text-xs">
        Typed in by hand for now — an AI photo read may fill these in
        automatically down the road.
      </p>

      {state.error && <p className="text-danger mb-2 text-sm">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-blue mt-2 w-full rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Scan"}
      </button>
    </form>
  );
}
