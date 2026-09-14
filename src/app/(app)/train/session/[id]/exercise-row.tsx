"use client";

import { useState, useTransition } from "react";
import { logExercise, reopenExercise } from "../../actions";

export function ExerciseRow({
  sessionId,
  exerciseId,
  name,
  targetLabel,
  completed,
  loggedLabel,
  lastLabel,
  defaultWeight,
  defaultReps,
}: {
  sessionId: string;
  exerciseId: string;
  name: string;
  targetLabel: string;
  completed: boolean;
  loggedLabel: string | null;
  lastLabel: string | null;
  defaultWeight: number | null;
  defaultReps: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(
    defaultWeight != null ? String(defaultWeight) : "",
  );
  const [reps, setReps] = useState(defaultReps != null ? String(defaultReps) : "");
  const [pending, startTransition] = useTransition();

  function submit() {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (Number.isNaN(w) || Number.isNaN(r)) return;
    startTransition(async () => {
      await logExercise(sessionId, exerciseId, w, r);
      setOpen(false);
    });
  }

  if (completed) {
    return (
      <div className="flex items-center justify-between rounded-[14px] bg-[#F0EEE9] px-4 py-3.5">
        <div>
          <p className="text-muted text-[16px] font-semibold line-through">
            {name}
          </p>
          <p className="text-muted text-[13px]">{loggedLabel ?? targetLabel}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => reopenExercise(sessionId, exerciseId))
          }
          aria-label="Reopen exercise"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="#2B7FAE"
            stroke="#2B7FAE"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="9" />
            <path
              d="M8 12.5l2.5 2.5L16 9.5"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[14px] border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)] ${
        open ? "border-blue border-2" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-[16px] font-semibold">{name}</p>
          <p className="text-muted text-[13px]">
            {targetLabel}
            {lastLabel ? ` · ${lastLabel}` : ""}
          </p>
        </div>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B8B4AB"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      </button>
      {open && (
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1">
            <span className="text-muted text-xs">Weight (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-[15px]"
            />
          </label>
          <label className="flex-1">
            <span className="text-muted text-xs">Reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-[15px]"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="bg-blue rounded-lg px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? "…" : "Done"}
          </button>
        </div>
      )}
    </div>
  );
}
