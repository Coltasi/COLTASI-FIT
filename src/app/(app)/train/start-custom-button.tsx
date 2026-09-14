"use client";

import { useTransition } from "react";
import { startCustomSession } from "./actions";

export function StartCustomButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => startCustomSession())}
      className="border-muted-2 flex w-full items-center justify-between rounded-[14px] border border-dashed bg-surface px-4 py-3.5 text-left disabled:opacity-60"
    >
      <div>
        <p className="text-[16px] font-semibold">
          {pending ? "Starting…" : "Custom Workout"}
        </p>
        <p className="text-muted text-[13px]">
          No plan — build it as you go, add any exercise
        </p>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8B4AB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}
