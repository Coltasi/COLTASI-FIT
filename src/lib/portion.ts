/** Nutrition on a label (or an estimate), for `baseG` grams, or for one pack/serving when baseG is null. */
export type Label = { kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; baseG: number | null; packG: number | null };
export type Macros = { kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null };

/** Quick picks: parts of a pack (or a serving), in the order they're shown. */
export const FRACTIONS: { v: number; l: string }[] = [
  { v: 1 / 4, l: "¼" }, { v: 1 / 3, l: "⅓" }, { v: 1 / 2, l: "½" }, { v: 2 / 3, l: "⅔" }, { v: 3 / 4, l: "¾" }, { v: 1, l: "1" }, { v: 1.5, l: "1½" }, { v: 2, l: "2" },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Scales a label to what was eaten. `amount` is grams when the label has baseG, otherwise packs/servings. */
export function scale(label: Label, amount: number): Macros {
  const f = label.baseG ? amount / label.baseG : amount;
  return {
    kcal: Math.round(label.kcal * f),
    protein_g: r1(label.protein_g * f),
    carbs_g: label.carbs_g == null ? null : r1(label.carbs_g * f),
    fat_g: label.fat_g == null ? null : r1(label.fat_g * f),
  };
}

export function fractionLabel(v: number) {
  return FRACTIONS.find((x) => Math.abs(x.v - v) < 0.005)?.l ?? String(r1(v));
}

/** Short text for the log line, e.g. "33 g" or "⅓ pack". Null for one whole pack/serving. */
export function portionText(label: Label, amount: number): string | null {
  if (label.baseG) return `${Math.round(amount)} g`;
  return Math.abs(amount - 1) < 0.005 ? null : `${fractionLabel(amount)} ${amount > 1 ? "packs" : "pack"}`;
}

/** "18 P · 30 C · 6 F" style macro line. Unknown carbs/fat are left out. */
export function macroLine(m: { protein_g: number | string; carbs_g?: number | string | null; fat_g?: number | string | null }) {
  const p = [`${Math.round(Number(m.protein_g))} g protein`];
  if (m.carbs_g != null) p.push(`${Math.round(Number(m.carbs_g))} g carbs`);
  if (m.fat_g != null) p.push(`${Math.round(Number(m.fat_g))} g fat`);
  return p.join(" · ");
}
