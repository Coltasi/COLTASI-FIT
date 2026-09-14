"use client";

import { useActionState } from "react";
import { updateProfile, type SettingsState } from "../actions";

const initialState: SettingsState = { error: null };

export function ProfileForm({
  defaultDisplayName,
  defaultSex,
  defaultBirthDate,
  defaultHeightCm,
}: {
  defaultDisplayName: string;
  defaultSex: string;
  defaultBirthDate: string;
  defaultHeightCm: number | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col">
        <span className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
          Name
        </span>
        <input
          type="text"
          name="display_name"
          defaultValue={defaultDisplayName}
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-[15px] outline-none focus:border-blue"
        />
      </label>

      <label className="flex flex-col">
        <span className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
          Sex
        </span>
        <select
          name="sex"
          defaultValue={defaultSex}
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-[15px] outline-none focus:border-blue"
        >
          <option value="">Not set</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>

      <label className="flex flex-col">
        <span className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
          Date of birth
        </span>
        <input
          type="date"
          name="birth_date"
          defaultValue={defaultBirthDate}
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-[15px] outline-none focus:border-blue"
        />
      </label>

      <label className="flex flex-col">
        <span className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
          Height (cm)
        </span>
        <input
          type="number"
          name="height_cm"
          step="0.1"
          defaultValue={defaultHeightCm ?? ""}
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-[15px] outline-none focus:border-blue"
        />
      </label>

      <p className="text-muted text-xs leading-relaxed">
        Sex feeds the TDEE calculation in Program &amp; Goals. Height and date
        of birth are saved for reference but aren&apos;t used by the current
        calculation, which relies on your actual scanned body fat % instead
        of an estimate.
      </p>

      {state.error && <p className="text-danger text-sm">{state.error}</p>}

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
