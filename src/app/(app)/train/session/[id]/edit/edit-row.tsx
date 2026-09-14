"use client";

import { useTransition } from "react";
import { moveSessionExercise, removeExerciseFromSession } from "../../../actions";

export function EditRow({
  sessionId,
  exerciseId,
  name,
  targetLabel,
  isFirst,
  isLast,
}: {
  sessionId: string;
  exerciseId: string;
  name: string;
  targetLabel: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-border flex items-center gap-2.5 rounded-[14px] border bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col">
        <button
          type="button"
          disabled={pending || isFirst}
          aria-label="Move up"
          onClick={() =>
            startTransition(() => moveSessionExercise(sessionId, exerciseId, "up"))
          }
          className="text-muted-2 disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          aria-label="Move down"
          onClick={() =>
            startTransition(() => moveSessionExercise(sessionId, exerciseId, "down"))
          }
          className="text-muted-2 disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <div className="flex-1">
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="text-muted text-[12px]">{targetLabel}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${name}`}
        onClick={() =>
          startTransition(() => removeExerciseFromSession(sessionId, exerciseId))
        }
        className="text-danger shrink-0 disabled:opacity-40"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M9 12h6" /></svg>
      </button>
    </div>
  );
}
