"use client";

import { useActionState } from "react";
import { updateGoals, type SettingsState } from "../actions";

const initialState: SettingsState = { error: null };

export function GoalsForm({ defaultRate }: { defaultRate: number }) {
  const [state, formAction, pending] = useActionState(updateGoals, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col">
        <span className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
          Target rate (kg/week)
        </span>
        <input
          type="number"
          name="rate_kg_per_week"
          step="0.05"
          defaultValue={defaultRate}
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-[15px] outline-none focus:border-blue"
        />
        <span className="text-muted mt-1.5 text-xs">
          Negative to cut, 0 to maintain, positive to (lean) bulk.
        </span>
      </label>

      {state.error && <p className="text-danger text-sm">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-blue mt-2 w-full rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
      >
        {pending ? "Calculating…" : "Recalculate & Save"}
      </button>
    </form>
  );
}
