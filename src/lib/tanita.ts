/**
 * Reading Tanita MC-780MA-N console photos.
 *
 * Every console page shows numbers that can be checked against each other, so a misread digit is caught in code
 * instead of being trusted:
 *  - Fat, Water, Muscle pages: the % line times weight must equal the kg line.
 *  - Muscle page: the five body-part numbers (trunk, arms, legs) must add up to the total.
 *  - BMR page: kJ must equal kcal x 4.184.
 *  - Every photo of one scan shows the same weight.
 * A value that fails its check is not filled in; the form asks for it instead.
 */

export const SCAN_KEYS = ["weight_kg", "body_fat_pct", "fat_mass_kg", "muscle_mass_kg", "water_pct", "visceral_fat", "bmr_kcal"] as const;
export type ScanKey = (typeof SCAN_KEYS)[number];
export type ScanValues = Partial<Record<ScanKey, number>>;

export const LABELS: Record<ScanKey, string> = {
  weight_kg: "Weight",
  body_fat_pct: "Body fat %",
  fat_mass_kg: "Fat mass",
  muscle_mass_kg: "Muscle mass",
  water_pct: "Water %",
  visceral_fat: "Visceral fat",
  bmr_kcal: "BMR",
};

/** Plausible ranges for an adult. Anything outside is a misread or a typo. */
export const RANGES: Record<ScanKey, [number, number]> = {
  weight_kg: [30, 300],
  body_fat_pct: [3, 60],
  fat_mass_kg: [1, 150],
  muscle_mass_kg: [20, 130],
  water_pct: [30, 75],
  visceral_fat: [1, 59],
  bmr_kcal: [800, 5000],
};

export const SCAN_PROMPT =
  "This photo shows the screen of a Tanita MC-780MA-N body composition monitor (or occasionally its paper printout).\n" +
  "Under the screen is a row of icons labelled FAT, Muscle, Water, Visceral, BMR. A small red light under ONE of them shows which page is on screen. " +
  "If none is lit and the right panel shows BMI, the page is \"bmi\".\n" +
  "RIGHT panel: the top line is Weight in kg. Below it are up to two more lines: a middle line (a %, or kJ on the BMR page, or BMI) and a bottom line (kg, kcal, or a plain number).\n" +
  "LEFT panel: on the Fat and Muscle pages it shows TRUNK at the top, then arm L, arm R, leg L, leg R. On the Muscle page these are kg; on the Fat page they are %.\n" +
  "Read every digit exactly as shown. These are 7-segment LCD digits: 1 and 7 differ only by the top bar, 5 and 6 by the lower-left bar, 8 and 0 by the middle bar, 3 and 9 by the upper-left bar. " +
  "Keep the decimal point exactly where it is. Do not guess or correct numbers; if a digit is unreadable use null.\n" +
  "Reply with ONLY JSON, no other text:\n" +
  '{"page": "fat"|"muscle"|"water"|"visceral"|"bmr"|"bmi"|"printout"|"unknown", "weight_kg": number|null, ' +
  '"middle": number|null, "middle_unit": "%"|"kJ"|"bmi"|null, "bottom": number|null, "bottom_unit": "kg"|"kcal"|"none"|null, ' +
  '"left": {"trunk": number|null, "arm_l": number|null, "arm_r": number|null, "leg_l": number|null, "leg_r": number|null} | null, ' +
  '"printout": null or, only for a paper printout, {weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, water_pct, visceral_fat, bmr_kcal}}';

export type PageRead = {
  page: string;
  weight_kg: number | null;
  middle: number | null;
  bottom: number | null;
  left: Record<"trunk" | "arm_l" | "arm_r" | "leg_l" | "leg_r", number | null> | null;
  printout: Record<string, unknown> | null;
};

const toNum = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Normalises the model's JSON reply. null if it isn't usable JSON. */
export function parseRead(text: string | null): PageRead | null {
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j: { page?: unknown; weight_kg?: unknown; middle?: unknown; bottom?: unknown; left?: unknown; printout?: unknown } | null;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const l = j?.left && typeof j.left === "object" ? (j.left as Record<string, unknown>) : null;
  return {
    page: typeof j?.page === "string" ? j.page.toLowerCase() : "unknown",
    weight_kg: toNum(j?.weight_kg),
    middle: toNum(j?.middle),
    bottom: toNum(j?.bottom),
    left: l ? { trunk: toNum(l.trunk), arm_l: toNum(l.arm_l), arm_r: toNum(l.arm_r), leg_l: toNum(l.leg_l), leg_r: toNum(l.leg_r) } : null,
    printout: j?.printout && typeof j.printout === "object" ? (j.printout as PageRead["printout"]) : null,
  };
}

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const inRange = (k: ScanKey, v: number) => v >= RANGES[k][0] && v <= RANGES[k][1];

/**
 * Turns one page read into scan values, keeping only values that pass the page's own checks.
 * `issue` says what failed, for the form. A page with an issue is worth re-reading.
 */
export function checkPage(r: PageRead): { values: ScanValues; issue: string | null } {
  const v: ScanValues = {};
  const w = r.weight_kg;
  if (w != null && inRange("weight_kg", w)) v.weight_kg = w;
  const pctOfWeight = (pct: number, kg: number) => w != null && close((w * pct) / 100, kg, 0.3);

  switch (r.page) {
    case "fat": {
      const pct = r.middle, kg = r.bottom;
      if (pct == null || kg == null) return { values: v, issue: "Fat screen: couldn't read both numbers." };
      if (!pctOfWeight(pct, kg)) return { values: v, issue: `Fat screen: ${pct}% of ${w} kg isn't ${kg} kg, so one number was misread.` };
      if (inRange("body_fat_pct", pct)) v.body_fat_pct = pct;
      if (inRange("fat_mass_kg", kg)) v.fat_mass_kg = kg;
      return { values: v, issue: null };
    }
    case "muscle": {
      const pct = r.middle, kg = r.bottom;
      if (kg == null) return { values: v, issue: "Muscle screen: couldn't read the kg number." };
      if (pct != null && !pctOfWeight(pct, kg)) return { values: v, issue: `Muscle screen: ${pct}% of ${w} kg isn't ${kg} kg, so one number was misread.` };
      const parts = r.left ? Object.values(r.left) : [];
      if (parts.length === 5 && parts.every((x) => x != null)) {
        const sum = (parts as number[]).reduce((a, b) => a + b, 0);
        if (!close(sum, kg, 0.3)) return { values: v, issue: `Muscle screen: body parts add up to ${sum.toFixed(1)} kg, not ${kg} kg.` };
      } else if (pct == null) {
        return { values: v, issue: "Muscle screen: nothing to double-check the total against." };
      }
      if (inRange("muscle_mass_kg", kg)) v.muscle_mass_kg = kg;
      return { values: v, issue: null };
    }
    case "water": {
      const pct = r.middle, kg = r.bottom;
      if (pct == null) return { values: v, issue: "Water screen: couldn't read the %." };
      if (kg != null && !pctOfWeight(pct, kg)) return { values: v, issue: `Water screen: ${pct}% of ${w} kg isn't ${kg} kg, so one number was misread.` };
      if (kg == null) return { values: v, issue: "Water screen: nothing to double-check the % against." };
      if (inRange("water_pct", pct)) v.water_pct = pct;
      return { values: v, issue: null };
    }
    case "visceral": {
      const n = r.bottom ?? r.middle;
      if (n == null || !Number.isInteger(n) || !inRange("visceral_fat", n)) return { values: v, issue: "Visceral screen: couldn't read the rating." };
      v.visceral_fat = n;
      return { values: v, issue: null };
    }
    case "bmr": {
      const kj = r.middle, kcal = r.bottom;
      if (kcal == null) return { values: v, issue: "BMR screen: couldn't read the kcal number." };
      if (kj == null || !close(kj, kcal * 4.184, 5)) return { values: v, issue: `BMR screen: ${kj ?? "?"} kJ doesn't match ${kcal} kcal, so one number was misread.` };
      if (inRange("bmr_kcal", kcal)) v.bmr_kcal = Math.round(kcal);
      return { values: v, issue: null };
    }
    case "printout": {
      for (const k of SCAN_KEYS) { const x = toNum(r.printout?.[k]); if (x != null && inRange(k, x)) v[k] = x; }
      return { values: v, issue: null };
    }
    case "bmi":
      return { values: v, issue: null };
    default:
      return { values: v, issue: "One photo didn't look like a Tanita screen." };
  }
}

/** Merges checked pages. Weight must agree across photos; if it doesn't, it's left for the user to type. */
export function mergePages(pages: { values: ScanValues; issue: string | null }[]): { values: ScanValues; issues: string[] } {
  const values: ScanValues = {};
  const issues = pages.map((p) => p.issue).filter((x): x is string => !!x);
  const weights = pages.map((p) => p.values.weight_kg).filter((x): x is number => x != null);
  const counts = new Map<number, number>();
  for (const x of weights) counts.set(x, (counts.get(x) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (top.length === 1 || (top.length > 1 && top[0][1] > top[1][1])) values.weight_kg = top[0][0];
  if (top.length > 1) issues.push(`Photos show different weights (${[...counts.keys()].join(", ")} kg). Are they all from the same scan?`);
  for (const p of pages) for (const k of SCAN_KEYS) if (k !== "weight_kg" && p.values[k] != null && values[k] == null) values[k] = p.values[k];
  return { values, issues };
}

/** Problems with a set of scan values, worded for the form. Empty means it looks right. */
export function scanProblems(v: ScanValues): string[] {
  const out: string[] = [];
  for (const k of SCAN_KEYS) {
    const x = v[k];
    if (x == null) continue;
    const [lo, hi] = RANGES[k];
    if (x < lo || x > hi) out.push(`${LABELS[k]} of ${x} can't be right (expected ${lo} to ${hi}).`);
  }
  if (v.weight_kg && v.body_fat_pct && v.fat_mass_kg) {
    const expect = (v.weight_kg * v.body_fat_pct) / 100;
    if (Math.abs(expect - v.fat_mass_kg) > 1) out.push(`Fat mass ${v.fat_mass_kg} kg doesn't match ${v.body_fat_pct}% of ${v.weight_kg} kg (about ${expect.toFixed(1)} kg). One of them is off.`);
  }
  if (v.weight_kg && v.muscle_mass_kg) {
    if (v.muscle_mass_kg >= v.weight_kg) out.push("Muscle mass can't be more than your weight.");
    else if (v.fat_mass_kg && v.fat_mass_kg + v.muscle_mass_kg > v.weight_kg) out.push("Fat plus muscle comes to more than your weight. One of them is off.");
  }
  return out;
}
