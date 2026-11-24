/** How hard one working set felt, tapped right after ticking it. */
export type SetEffort = "easy" | "hard" | "failed";

export const SET_EFFORTS: { id: SetEffort; label: string; sub: string }[] = [
  { id: "easy", label: "Easy", sub: "3+ left" },
  { id: "hard", label: "Hard", sub: "1–2 left" },
  { id: "failed", label: "Failed", sub: "0 left" },
];

export const SET_EFFORT_LABEL: Record<SetEffort, string> = { easy: "Easy", hard: "Hard", failed: "Failed" };

export const isSetEffort = (v: unknown): v is SetEffort => v === "easy" || v === "hard" || v === "failed";

/** A hard set: close to failure (Hard) or to failure (Failed). */
export const isHardSet = (e: SetEffort | null | undefined) => e === "hard" || e === "failed";

/** The cue shown on every lift so the rep target means effort, not a number to stop at. */
export const GRIND_CUE = "Last rep should be a grind";
