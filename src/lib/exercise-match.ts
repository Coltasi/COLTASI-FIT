/**
 * Exercise name matching. Two names that mean the same lift ("KB swings", "Kettlebell Swing")
 * get the same key, so history, search and "add exercise" treat them as one exercise.
 *
 * To teach it a new abbreviation, add a line to SYNONYMS (single words) or PHRASES (multi-word).
 */

/** Single-word abbreviations and spellings -> the full words they stand for. */
const SYNONYMS: Record<string, string> = {
  kb: "kettlebell", kbs: "kettlebell",
  db: "dumbbell", dbs: "dumbbell", dumbell: "dumbbell", dumbells: "dumbbell",
  bb: "barbell",
  oh: "overhead", ohp: "overhead press",
  rdl: "romanian deadlift", sldl: "single leg romanian deadlift",
  dl: "deadlift", bp: "bench press",
  tgu: "turkish getup",
  ghr: "glute ham raise",
  bicep: "biceps", tricep: "triceps",
  flies: "fly", flyes: "fly",
  abs: "ab",
  bw: "bodyweight",
};

/** Multi-word spellings collapsed into one token before splitting. */
const PHRASES: [RegExp, string][] = [
  [/\bpull ?downs?\b/g, "pulldown"],
  [/\bpull ?ups?\b/g, "pullup"],
  [/\bchin ?ups?\b/g, "chinup"],
  [/\bpush ?ups?\b/g, "pushup"],
  [/\bsit ?ups?\b/g, "situp"],
  [/\bget ?ups?\b/g, "getup"],
  [/\bstep ?ups?\b/g, "stepup"],
  [/\bsingle ?(arm|leg)\b/g, "single $1"],
  [/\b(1|one) ?(arm|leg)\b/g, "single $2"],
  [/\bpec ?dec?k\b/g, "pecdeck"],
  [/\bface ?pulls?\b/g, "facepull"],
  [/\bskull ?crushers?\b/g, "skullcrusher"],
  [/\bhip ?thrusts?\b/g, "hipthrust"],
  // Flat-back, glute-led 45° back extension = the 45-Degree Hip Hinge (not the spine-rounding version).
  [/\b(?:glute[- ]?focused )?45[- ]?(?:degree|deg|°)? ?(?:hip ?hinges?|back ?extensions?)\b/g, "45degree hiphinge"],
  [/\bglute[- ]?focused back ?extensions?\b/g, "45degree hiphinge"],
];

const NO_SINGULAR = new Set(["biceps", "triceps", "press", "glutes", "ab"]);

function singular(w: string): string {
  if (w.length <= 3 || NO_SINGULAR.has(w) || !w.endsWith("s")) return w;
  if (/(ss|us|is)$/.test(w)) return w;
  return w.slice(0, -1);
}

/** Lowercase words of a name with abbreviations expanded and plurals folded. Order kept. */
export function exerciseTokens(name: string): string[] {
  let s = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  const out: string[] = [];
  for (const raw of s.split(" ").filter(Boolean)) {
    for (const e of (SYNONYMS[raw] ?? raw).split(" ")) out.push(singular(e));
  }
  return out;
}

/** Same key = same exercise. Word order doesn't matter. */
export function exerciseKey(name: string): string {
  return [...new Set(exerciseTokens(name))].sort().join(" ");
}

/**
 * Typeahead score: 0 = no match. Every word typed has to start some word of the name
 * (so "kb sw" finds Kettlebell Swing). Exact same-exercise matches rank first.
 */
export function matchScore(query: string, name: string): number {
  const q = exerciseTokens(query);
  if (!q.length) return 0;
  const n = exerciseTokens(name);
  if (!q.every((t) => n.some((w) => w.startsWith(t)))) return 0;
  if (exerciseKey(query) === exerciseKey(name)) return 100;
  const exactWords = q.filter((t) => n.includes(t)).length;
  return 10 + exactWords * 2 - Math.max(0, n.length - q.length) * 0.1;
}

export type ExerciseRow = { id: string; name: string; created_by: string | null; created_at?: string };
export type ExerciseGroup = { key: string; rep: ExerciseRow; ids: string[]; names: string[] };

/**
 * Groups exercise rows that share a key. The representative is the program's own lift when
 * there is one (it keeps the clean name and the how-to guide), else the oldest personal one.
 */
export function groupExercises(rows: ExerciseRow[]): { groups: ExerciseGroup[]; keyById: Map<string, string>; byKey: Map<string, ExerciseGroup> } {
  const byKey = new Map<string, ExerciseGroup>();
  const sorted = [...rows].sort((a, b) =>
    (a.created_by == null ? 0 : 1) - (b.created_by == null ? 0 : 1) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const keyById = new Map<string, string>();
  for (const r of sorted) {
    const key = exerciseKey(r.name) || r.name.toLowerCase();
    keyById.set(r.id, key);
    const g = byKey.get(key);
    if (!g) byKey.set(key, { key, rep: r, ids: [r.id], names: [r.name] });
    else { g.ids.push(r.id); g.names.push(r.name); }
  }
  return { groups: [...byKey.values()], keyById, byKey };
}
