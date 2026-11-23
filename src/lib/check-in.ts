import { isEffort } from "./effort";

/** Optional end-of-workout check-in: how it felt, any niggles, a note for the Coach. */
export type Feel = "strong" | "normal" | "low" | "sick";
export const FEELS: Feel[] = ["strong", "normal", "low", "sick"];
export const FEEL_LABEL: Record<Feel, string> = { strong: "Felt strong", normal: "Normal", low: "Low energy", sick: "Sick" };

export type PainArea = "lower_back" | "upper_back" | "neck" | "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle" | "other";
export const PAIN_AREAS: PainArea[] = ["lower_back", "upper_back", "neck", "shoulder", "elbow", "wrist", "hip", "knee", "ankle", "other"];
export const PAIN_LABEL: Record<PainArea, string> = {
  lower_back: "Lower back", upper_back: "Upper back", neck: "Neck", shoulder: "Shoulder", elbow: "Elbow",
  wrist: "Wrist", hip: "Hip", knee: "Knee", ankle: "Ankle", other: "Other",
};

export const NOTE_MAX = 1000;

/** Reads the check-in fields from the Finish form. Anything unrecognised is dropped. */
export function parseCheckIn(fd: FormData | undefined) {
  if (!fd) return { feel: null, pain_areas: [] as PainArea[], notes: null, effort: null };
  const f = String(fd.get("feel") ?? "");
  const feel = (FEELS as string[]).includes(f) ? (f as Feel) : null;
  const pain_areas = [...new Set(fd.getAll("pain").map(String))].filter((p): p is PainArea => (PAIN_AREAS as string[]).includes(p));
  const n = String(fd.get("notes") ?? "").trim().slice(0, NOTE_MAX);
  const e = String(fd.get("effort") ?? "");
  return { feel, pain_areas, notes: n || null, effort: isEffort(e) ? e : null };
}
