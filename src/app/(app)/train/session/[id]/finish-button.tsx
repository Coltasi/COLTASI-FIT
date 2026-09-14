"use client";

import { useTransition } from "react";
import { finishSession } from "../../actions";

export function FinishButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => finishSession(sessionId))}
      className="bg-blue w-full rounded-xl py-4 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
    >
      {pending ? "Finishing…" : "Finish Workout"}
    </button>
  );
}
