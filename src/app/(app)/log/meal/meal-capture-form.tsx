"use client";

import { useActionState, useState } from "react";
import { logMeal, type LogMealState } from "../actions";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

function defaultMealType() {
  const h = new Date().getHours();
  if (h < 11) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 21) return "Dinner";
  return "Snack";
}

const initialState: LogMealState = { error: null };

export function MealCaptureForm() {
  const [state, formAction, pending] = useActionState(logMeal, initialState);
  const [mealType, setMealType] = useState(defaultMealType());
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  return (
    <form action={formAction}>
      <input type="hidden" name="meal_type" value={mealType} />

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        Photo · optional
      </p>
      <div className="mb-5 flex gap-2.5">
        <label className="border-muted-2 bg-border relative flex h-24 w-24 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed text-2xl text-[#B8B4AB]">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            "+"
          )}
          <input
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhotoPreview(URL.createObjectURL(file));
              else setPhotoPreview(null);
            }}
          />
        </label>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">When</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            className={`rounded-full border px-3.5 py-2 text-sm ${
              mealType === t ? "bg-blue border-blue text-white" : "border-[#E4E1D9]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        What did you eat?
      </p>
      <div className="mb-3 flex flex-col gap-2.5">
        <input
          type="text"
          name="name"
          required
          placeholder="Meal name, e.g. Chicken & rice bowl"
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_3px_8px_rgba(0,0,0,0.03)] outline-none focus:border-blue"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Calories</span>
            <input
              type="number"
              name="calories"
              min={0}
              inputMode="numeric"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Protein (g)</span>
            <input
              type="number"
              name="protein_g"
              min={0}
              inputMode="numeric"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Carbs (g)</span>
            <input
              type="number"
              name="carbs_g"
              min={0}
              inputMode="numeric"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-muted mb-1 text-xs">Fat (g)</span>
            <input
              type="number"
              name="fat_g"
              min={0}
              inputMode="numeric"
              className="border-border bg-surface rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-blue"
            />
          </label>
        </div>
        <textarea
          name="notes"
          rows={2}
          placeholder="Notes (optional)"
          className="border-border bg-surface rounded-xl border px-3.5 py-3 text-sm outline-none focus:border-blue"
        />
      </div>

      <p className="text-muted mb-4 text-xs">
        Typed in by hand for now — an AI photo estimate may fill these in
        automatically down the road.
      </p>

      {state.error && <p className="text-danger mb-2 text-sm">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-blue w-full rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Meal"}
      </button>
    </form>
  );
}
