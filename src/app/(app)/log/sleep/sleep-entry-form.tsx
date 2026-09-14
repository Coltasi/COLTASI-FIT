"use client";

import { useActionState, useState } from "react";
import { logSleep, type LogSleepState } from "../actions";

const WOKE_OPTIONS = ["Energetic", "Rested", "Groggy", "Tired", "Exhausted"];
const TAG_OPTIONS = [
  "Interrupted sleep",
  "Woke up early",
  "Restless",
  "Nightmares",
  "Good dreams",
  "Slept through",
];

const initialState: LogSleepState = { error: null };

export function SleepEntryForm({ defaultHours }: { defaultHours: number }) {
  const [state, formAction, pending] = useActionState(logSleep, initialState);
  const [hours, setHours] = useState(defaultHours);
  const [woke, setWoke] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  function toggleTag(t: string) {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="hours" value={hours} />
      {woke && <input type="hidden" name="woke_feeling" value={woke} />}
      {tags.map((t) => (
        <input key={t} type="hidden" name="tags" value={t} />
      ))}

      <div className="border-border bg-surface mb-5 rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
          Hours
        </p>
        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => setHours((h) => Math.max(0, Math.round((h - 0.1) * 10) / 10))}
            className="border-border flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border text-lg"
          >
            −
          </button>
          <div className="font-display min-w-[100px] text-center text-[28px] font-extrabold tracking-tight">
            {hours.toFixed(1)} <span className="text-muted font-sans text-sm font-medium">hrs</span>
          </div>
          <button
            type="button"
            onClick={() => setHours((h) => Math.round((h + 0.1) * 10) / 10)}
            className="border-border flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border text-lg"
          >
            +
          </button>
        </div>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        How did you wake up?
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {WOKE_OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setWoke(o)}
            className={`rounded-full border px-3.5 py-2 text-sm ${
              woke === o ? "border-blue bg-[#E7F1F7] text-blue" : "border-[#E4E1D9] text-muted"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        Anything unusual? · pick any
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {TAG_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleTag(t)}
            className={`rounded-full border px-3.5 py-2 text-sm ${
              tags.includes(t) ? "border-blue bg-[#E7F1F7] text-blue" : "border-[#E4E1D9] text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        Anything else for Coach? · optional
      </p>
      <textarea
        name="notes"
        rows={3}
        placeholder="e.g. stressed about a work thing, room was too warm…"
        className="border-border bg-surface mb-2 w-full rounded-xl border px-3.5 py-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.03),0_3px_8px_rgba(0,0,0,0.03)] outline-none focus:border-blue"
      />

      {state.error && <p className="text-danger mb-2 text-sm">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-blue mt-2 w-full rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
