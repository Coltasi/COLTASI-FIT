"use client";

import { useState, useTransition } from "react";
import { logSet, reopenSet } from "../../actions";

export type SessionSet = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  lastWeight: number | null;
  lastReps: number | null;
};

function SetRow({
  sessionId,
  exerciseId,
  set,
}: {
  sessionId: string;
  exerciseId: string;
  set: SessionSet;
}) {
  const [weight, setWeight] = useState(
    set.weightKg != null ? String(set.weightKg) : set.lastWeight != null ? String(set.lastWeight) : "",
  );
  const [reps, setReps] = useState(
    set.reps != null ? String(set.reps) : set.lastReps != null ? String(set.lastReps) : "",
  );
  const [pending, startTransition] = useTransition();

  function submit() {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (Number.isNaN(w) || Number.isNaN(r)) return;
    startTransition(() => logSet(sessionId, exerciseId, set.setNumber, w, r));
  }

  if (set.completed) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-[#F0EEE9] px-2.5 py-2">
        <span className="text-muted w-11 shrink-0 text-[12px] font-semibold">
          Set {set.setNumber}
        </span>
        <span className="text-muted flex-1 text-[13px] line-through">
          {set.weightKg} kg × {set.reps}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => reopenSet(sessionId, exerciseId, set.setNumber))
          }
          aria-label={`Reopen set ${set.setNumber}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#2B7FAE" stroke="#2B7FAE" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>
    );
  }

  const placeholderWeight = set.lastWeight != null ? String(set.lastWeight) : "kg";
  const placeholderReps = set.lastReps != null ? String(set.lastReps) : "reps";

  return (
    <div className="flex items-center gap-2 rounded-lg px-0.5 py-1">
      <span className="text-muted w-11 shrink-0 text-[12px] font-semibold">
        Set {set.setNumber}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        placeholder={placeholderWeight}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="border-border w-full min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-[14px]"
      />
      <input
        type="number"
        inputMode="numeric"
        placeholder={placeholderReps}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        className="border-border w-full min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-[14px]"
      />
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        aria-label={`Mark set ${set.setNumber} done`}
        className="bg-blue shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "…" : "✓"}
      </button>
    </div>
  );
}

export function ExerciseRow({
  sessionId,
  exerciseId,
  name,
  targetLabel,
  sets,
  lastLabel,
}: {
  sessionId: string;
  exerciseId: string;
  name: string;
  targetLabel: string;
  sets: SessionSet[];
  lastLabel: string | null;
}) {
  const allDone = sets.length > 0 && sets.every((s) => s.completed);
  const doneCount = sets.filter((s) => s.completed).length;
  const [reviewOpen, setReviewOpen] = useState(false);

  if (allDone && !reviewOpen) {
    return (
      <button
        type="button"
        onClick={() => setReviewOpen(true)}
        className="flex w-full items-center justify-between rounded-[14px] bg-[#F0EEE9] px-4 py-3.5 text-left"
      >
        <div>
          <p className="text-muted text-[16px] font-semibold line-through">{name}</p>
          <p className="text-muted text-[13px]">{targetLabel} · all sets logged</p>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8B4AB" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
        </svg>
      </button>
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <p className="text-[16px] font-semibold">{name}</p>
          <p className="text-muted text-[13px]">
            {targetLabel} · {doneCount}/{sets.length} sets
            {lastLabel ? ` · ${lastLabel}` : ""}
          </p>
        </div>
        {allDone && (
          <button
            type="button"
            onClick={() => setReviewOpen(false)}
            className="text-blue text-[13px] font-semibold"
          >
            Collapse
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {sets.map((s) => (
          <SetRow key={s.setNumber} sessionId={sessionId} exerciseId={exerciseId} set={s} />
        ))}
      </div>
    </div>
  );
}
