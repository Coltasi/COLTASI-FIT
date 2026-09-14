"use client";

import { useState, useTransition } from "react";
import { addExerciseToSession } from "../../../../actions";

export function AddExerciseRow({
  sessionId,
  exerciseId,
  name,
  modality,
}: {
  sessionId: string;
  exerciseId: string;
  name: string;
  modality: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState("3");
  const [repRange, setRepRange] = useState("8-12");
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <div className="flex items-center justify-between rounded-[14px] bg-[#F0EEE9] px-4 py-3.5">
        <p className="text-muted text-[15px] font-semibold">{name}</p>
        <span className="text-muted text-[12px]">Added ✓</span>
      </div>
    );
  }

  function submit() {
    const s = Math.max(1, parseInt(sets, 10) || 3);
    startTransition(async () => {
      await addExerciseToSession(sessionId, exerciseId, s, repRange.trim());
      setAdded(true);
    });
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
          <p className="text-[15px] font-semibold">{name}</p>
          {modality && <p className="text-muted text-[12px] capitalize">{modality}</p>}
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8B4AB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      {open && (
        <div className="mt-3 flex items-end gap-2">
          <label className="w-20">
            <span className="text-muted text-xs">Sets</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-[15px]"
            />
          </label>
          <label className="flex-1">
            <span className="text-muted text-xs">Rep range</span>
            <input
              type="text"
              placeholder="e.g. 8-12"
              value={repRange}
              onChange={(e) => setRepRange(e.target.value)}
              className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-[15px]"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="bg-blue rounded-lg px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? "…" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
