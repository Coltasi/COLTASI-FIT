"use client";

import { useState, useTransition } from "react";
import { setSessionFlag } from "../../actions";

export function FlagRow({
  sessionId,
  field,
  label,
  sub,
  initialDone,
}: {
  sessionId: string;
  field: "warmup_done" | "ab_finisher_done" | "cooldown_done";
  label: string;
  sub: string;
  initialDone: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !done;
    setDone(next);
    startTransition(() => setSessionFlag(sessionId, field, next));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`flex w-full items-center justify-between rounded-[14px] border px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)] ${
        done ? "border-transparent bg-[#F0EEE9]" : "border-border bg-surface"
      }`}
    >
      <div>
        <p
          className={`text-[16px] font-semibold ${
            done ? "text-muted line-through" : ""
          }`}
        >
          {label}
        </p>
        <p className="text-muted text-[13px]">{done ? "done" : sub}</p>
      </div>
      {done ? (
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
      ) : (
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
      )}
    </button>
  );
}
