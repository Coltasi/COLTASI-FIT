"use client";

import { useState, useTransition } from "react";
import { startSession } from "../../actions";

const WARMUP_OPTIONS = ["Stairmaster", "Elliptical", "Treadmill", "Rowing"];

export function StartSessionForm({
  dayId,
  dayName,
}: {
  dayId: string;
  dayName: string;
}) {
  const [warmup, setWarmup] = useState(WARMUP_OPTIONS[0]);
  const [abFinisher, setAbFinisher] = useState(true);
  const [cooldown, setCooldown] = useState(true);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <p className="text-muted mb-2 mt-[18px] text-xs font-bold tracking-wide uppercase">
        Warm-up · 10 min
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {WARMUP_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setWarmup(opt)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
              warmup === opt
                ? "border-blue bg-[#E7F1F7] text-blue"
                : "border-[#E4E1D9] text-muted"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted text-xs font-bold tracking-wide uppercase">
          Ab Finisher
        </p>
        <button
          type="button"
          onClick={() => setAbFinisher((v) => !v)}
          className={`relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors ${
            abFinisher ? "bg-blue" : "bg-[#E4E1D9]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all ${
              abFinisher ? "right-0.5" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <p className="text-muted mb-5 text-[13px]">Plank series</p>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-muted mb-0.5 text-xs font-bold tracking-wide uppercase">
            Cool Down · 5 min
          </p>
          <p className="text-muted text-[13px]">Stretch &amp; breathing</p>
        </div>
        <button
          type="button"
          onClick={() => setCooldown((v) => !v)}
          className={`relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors ${
            cooldown ? "bg-blue" : "bg-[#E4E1D9]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all ${
              cooldown ? "right-0.5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            startSession(dayId, dayName, warmup, abFinisher, cooldown),
          )
        }
        className="bg-blue w-full rounded-xl py-4 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start Workout"}
      </button>
    </>
  );
}
