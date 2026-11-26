/**
 * Coach signals: every number and every judgement in a Coach read is worked out here, in code.
 * The model only rewords these results; it never compares weights or decides anything.
 * Pure functions, no database access, so they can be checked against real data offline.
 */

/** effort: how hard the set felt, if it was rated (easy = 3+ reps left, hard = 1-2, failed = 0). */
import { isBosu, isGetUp } from "./placement";

export type SetRow = { weight_kg: number | null; reps: number | null; effort?: "easy" | "hard" | "failed" | null };
export type Perf = { date: string; sets: SetRow[] };
export type LiftInput = {
  name: string;
  modality: string | null;
  repRange: string | null;
  /** Finished sessions of this lift, oldest first (includes the session just finished). */
  history: Perf[];
};

export type Call = "up" | "hold" | "back_off" | "new";
export type LiftSignal = {
  name: string;
  call: Call;
  bodyweight: boolean;
  repRange: string | null;
  /** Top working weight last time (null for bodyweight). */
  top: number | null;
  /** Working reps last time, in set order. */
  reps: number[];
  /** Change in top weight vs the session before (positive = heavier). null when there is no earlier session. */
  change: { from: number | null; to: number | null; kg: number | null; repsFrom: number[] } | null;
  /** Suggested weight for next time (up or back_off). */
  nextKg: number | null;
  /** Sessions in a row without beating the earlier best (back_off only). */
  stalledFor: number;
  /** Plain one-line instruction, already worded. */
  line: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
export const kg = (n: number) => `${r1(n)} kg`;

/** Rep target for one set. "6–8 / 8–10 / 10–12" gives a range per set; "10+" means at least 10. */
export function rangeForSet(range: string | null, i: number): { lo: number; hi: number } | null {
  if (!range) return null;
  const parts = range.split("/").map((p) => p.trim()).filter(Boolean);
  const p = parts[Math.min(i, parts.length - 1)] ?? "";
  const m = p.match(/(\d+)\s*[–—-]\s*(\d+)/);
  if (m) return { lo: Number(m[1]), hi: Number(m[2]) };
  const one = p.match(/(\d+)/);
  return one ? { lo: Number(one[1]), hi: Number(one[1]) } : null;
}

/** Sets that count: reps logged, and weight logged unless the lift is bodyweight. */
function working(sets: SetRow[], bodyweight: boolean) {
  return sets.filter((s) => (s.reps ?? 0) > 0 && (bodyweight || Number(s.weight_kg ?? 0) > 0));
}

type Summary = { date: string; top: number | null; reps: number[]; repsAtTop: number; hitTop: boolean; score: number; allEasy: boolean; anyHard: boolean };

function summarise(p: Perf, bodyweight: boolean, range: string | null): Summary | null {
  const ws = working(p.sets, bodyweight);
  if (!ws.length) return null;
  const reps = ws.map((s) => s.reps as number);
  const top = bodyweight ? null : Math.max(...ws.map((s) => Number(s.weight_kg)));
  const repsAtTop = ws.filter((s) => bodyweight || Number(s.weight_kg) === top).reduce((a, s) => a + (s.reps as number), 0);
  const hitTop = range != null && ws.every((s, i) => {
    const r = rangeForSet(range, i);
    return r != null && (s.reps as number) >= r.hi;
  });
  const rated = ws.filter((s) => s.effort);
  const allEasy = rated.length > 0 && rated.every((s) => s.effort === "easy");
  const anyHard = ws.some((s) => s.effort === "hard" || s.effort === "failed");
  return { date: p.date, top, reps, repsAtTop, hitTop, score: (top ?? 0) * 1000 + repsAtTop, allEasy, anyHard };
}

const STEP: Record<string, number> = { dumbbell: 2, barbell: 2.5, cable: 2.5, machine: 2.5 };

function stepUp(top: number, modality: string | null, kettlebells: number[]): number | null {
  if (modality === "kettlebell") return kettlebells.filter((k) => k > top).sort((a, b) => a - b)[0] ?? null;
  return r1(top + (STEP[modality ?? ""] ?? 2));
}
function stepDown(top: number, modality: string | null, kettlebells: number[]): number {
  if (modality === "kettlebell") return kettlebells.filter((k) => k < top).sort((a, b) => b - a)[0] ?? top;
  const step = STEP[modality ?? ""] ?? 2;
  return Math.max(step, Math.floor((top * 0.9) / step) * step);
}

export function liftSignal(l: LiftInput, kettlebells: number[], easeOff: boolean, easeWhy: "sleep" | "sick" = "sleep"): LiftSignal | null {
  const bodyweight = l.modality === "bodyweight" || !l.history.some((p) => p.sets.some((s) => Number(s.weight_kg ?? 0) > 0 && (s.reps ?? 0) > 0));
  const S = l.history.map((p) => summarise(p, bodyweight, l.repRange)).filter((x): x is Summary => x != null);
  if (!S.length) return null;
  const last = S[S.length - 1];
  const prev = S.length > 1 ? S[S.length - 2] : null;
  const range = l.repRange;
  const hiFirst = rangeForSet(range, 0)?.hi ?? null;
  const hiAll = range && !range.includes("/") ? hiFirst : null;
  const target = hiAll != null ? `${hiAll} on every set` : range ? "the top of each set's range" : "one more rep per set";

  const change = prev
    ? { from: prev.top, to: last.top, kg: last.top != null && prev.top != null ? r1(last.top - prev.top) : null, repsFrom: prev.reps }
    : null;

  let call: Call = "hold";
  let nextKg: number | null = null;
  let stalledFor = 0;
  /** Why it's going up, when it isn't the usual "hit the top of the range twice". */
  let upWhy: "easy" | "flat" | null = null;
  let flatFor = 0;
  // Balance work (Bosu, Turkish Get-Ups) is about control, not grinding reps: no "go heavier" pushes from effort.
  const balance = isBosu(l.name) || isGetUp(l.name);
  // Rated Easy two sessions running: the weight is too light, whatever the reps say.
  const easyUp = prev && !bodyweight && !balance && last.allEasy && prev.allEasy ? stepUp(last.top as number, l.modality, kettlebells) : null;
  if (!prev) call = "new";
  else if (easyUp != null && !(last.hitTop && prev.hitTop && last.top === prev.top)) {
    call = "up"; upWhy = "easy"; nextKg = easyUp;
  } else if (last.hitTop && prev.hitTop && last.top === prev.top) {
    call = "up";
    nextKg = bodyweight ? null : stepUp(last.top as number, l.modality, kettlebells);
    if (!bodyweight && nextKg == null) call = "hold"; // already on the heaviest kettlebell
  } else {
    // Trailing sessions that didn't beat the best before them (heavier, or more reps at the same weight).
    for (let i = S.length - 1; i >= 1; i--) {
      if (S[i].score <= Math.max(...S.slice(0, i).map((s) => s.score))) stalledFor++;
      else break;
    }
    // Same weight and the same reps on every set, session after session, with no set rated Hard:
    // that's stopping at a number, not at your limit. Go heavier instead of backing off.
    const same = (a: Summary, b: Summary) => a.top === b.top && a.reps.length === b.reps.length && a.reps.every((r, i) => r === b.reps[i]);
    for (let i = S.length - 1; i >= 1 && same(S[i], S[i - 1]); i--) flatFor = flatFor ? flatFor + 1 : 2;
    const flatUp = !bodyweight && !balance && flatFor >= 3 && new Set(last.reps).size === 1
      && !S.slice(-flatFor).some((x) => x.anyHard) ? stepUp(last.top as number, l.modality, kettlebells) : null;
    if (flatUp != null) {
      call = "up"; upWhy = "flat"; nextKg = flatUp; stalledFor = 0;
    } else if (stalledFor >= 3 && !(change?.kg != null && change.kg > 0)) {
      // Never tell someone who just went heavier to back off: a heavier top set with fewer reps is progress in the making.
      call = "back_off";
      nextKg = bodyweight ? null : stepDown(last.top as number, l.modality, kettlebells);
    } else stalledFor = 0;
  }

  // Balance work never gets a "go heavier" push: control comes first, and heavy Bosu work tires the stabilisers.
  if (balance && call === "up") { call = "hold"; nextKg = null; upWhy = null; }

  const repsTxt = last.reps.join(", ");
  const w = last.top != null ? kg(last.top) : "bodyweight";
  const diff =
    change?.kg != null && change.kg !== 0 && change.from != null
      ? ` (${change.kg > 0 ? "up" : "down"} ${kg(Math.abs(change.kg))} from ${kg(change.from)} last time)`
      : "";
  let line: string;
  if (call === "up" && easeOff) {
    line = bodyweight
      ? `${l.name}: ready to add reps, but ${easeWhy === "sick" ? "you're under the weather" : "sleep says ease off"}. Repeat ${repsTxt} for now.`
      : `${l.name}: ready for ${kg(nextKg!)}, but ${easeWhy === "sick" ? "you're under the weather" : "sleep says ease off"}. Stay at ${w} until ${easeWhy === "sick" ? "you're feeling better" : "you've had a good night"}.`;
  } else if (call === "up" && upWhy === "easy") {
    line = `${l.name}: you rated it Easy two sessions running. Go to ${kg(nextKg!)} on set 1.`;
  } else if (call === "up" && upWhy === "flat") {
    line = `${l.name}: same ${w} × ${last.reps[0]} on every set for ${flatFor} sessions. Go to ${kg(nextKg!)} and fight for the reps.`;
  } else if (call === "up") {
    line = bodyweight
      ? `${l.name}: go up. Add 2 reps to every set, or add weight. You hit ${target} two sessions running.`
      : `${l.name}: go to ${kg(nextKg!)} on set 1. You hit ${target} at ${w} two sessions running.`;
  } else if (call === "back_off") {
    line = bodyweight
      ? `${l.name}: no progress in ${stalledFor} sessions. Drop a set and slow the tempo, or swap it for a similar move.`
      : `${l.name}: no progress in ${stalledFor} sessions. Drop to ${kg(nextKg!)} and build back to ${target}, or swap it for a similar lift.`;
  } else if (balance && call === "hold") {
    line = `${l.name}: keep it smooth and controlled at ${w}. Balance work is about control, not load.`;
  } else if (call === "new") {
    line = `${l.name}: first time logged at ${w} (${repsTxt}). Repeat it and aim for ${target}.`;
  } else {
    line = bodyweight
      ? `${l.name}: aim for ${target}. Last time ${repsTxt}.`
      : `${l.name}: stay at ${w}, aim for ${target}. Last time ${repsTxt}${diff}.`;
  }
  // First working set way above the range (e.g. 12 reps on a 4–6 lift) is a warm-up, not a working set.
  const r0 = rangeForSet(range, 0);
  if (r0 && last.reps[0] != null && last.reps[0] >= r0.hi + 3) line += ` Start set 1 inside ${r0.lo === r0.hi ? r0.lo : `${r0.lo}–${r0.hi}`} reps.`;
  return { name: l.name, call, bodyweight, repRange: range, top: last.top, reps: last.reps, change, nextKg, stalledFor, line };
}

/* ------------------------------------------------------------------ split days */

export type DayDue = { name: string; lastDone: string | null; daysSince: number | null };

/** Split days, most overdue first. Never-done days come first. */
export function splitDue(days: { id: string; name: string }[], lastDoneById: Map<string, string>, today: string): DayDue[] {
  const diff = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
  return days
    .map((d) => {
      const last = lastDoneById.get(d.id) ?? null;
      return { name: d.name, lastDone: last, daysSince: last ? diff(last, today) : null };
    })
    .sort((a, b) => (b.daysSince ?? 1e9) - (a.daysSince ?? 1e9));
}

/* ------------------------------------------------------------------ sleep */

export type Night = { night_of: string; hours: number; wake_feeling: string | null; flags: string[] };
export type Window = { nights: number; avgHours: number | null; under6: number; feelings: string[]; flags: Record<string, number> };
export type SleepSignal = {
  lastNight: Night | null;
  last3: Window;
  last7: Window;
  /** push = go for increases; normal = train as planned; ease = keep weights, drop a set, no PRs; unknown = no sleep logged. */
  call: "push" | "normal" | "ease" | "unknown";
  reasons: string[];
  line: string;
};

const BAD_WAKE = new Set(["groggy", "tired", "exhausted"]);
const GOOD_WAKE = new Set(["rested", "energetic"]);

function windowOf(nights: Night[]): Window {
  const flags: Record<string, number> = {};
  for (const n of nights) for (const f of n.flags ?? []) flags[f] = (flags[f] ?? 0) + 1;
  return {
    nights: nights.length,
    avgHours: nights.length ? r1(nights.reduce((a, n) => a + Number(n.hours), 0) / nights.length) : null,
    under6: nights.filter((n) => Number(n.hours) < 6).length,
    feelings: nights.map((n) => n.wake_feeling).filter((x): x is string => !!x),
    flags,
  };
}

/** `today` is the day the advice is for; last night is the night_of the day before. */
export function sleepSignal(all: Night[], today: string): SleepSignal {
  const back = (n: number) => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const within = (n: number) => all.filter((x) => x.night_of >= back(n) && x.night_of <= back(1));
  const lastNight = all.find((x) => x.night_of === back(1)) ?? null;
  const last3 = windowOf(within(3));
  const last7 = windowOf(within(7));
  const reasons: string[] = [];
  if (last3.under6 >= 2) reasons.push(`under 6 hours on ${last3.under6} of the last 3 nights`);
  if (lastNight && Number(lastNight.hours) < 6 && last3.under6 < 2) reasons.push(`only ${r1(Number(lastNight.hours))} hours last night`);
  if (lastNight?.wake_feeling && BAD_WAKE.has(lastNight.wake_feeling)) reasons.push(`woke ${lastNight.wake_feeling}`);
  if (lastNight?.flags?.includes("interrupted") && Number(lastNight.hours) < 7) reasons.push("broken sleep");

  let call: SleepSignal["call"];
  if (reasons.length) call = "ease";
  else if (!lastNight) call = "unknown";
  else if (Number(lastNight.hours) >= 7 && GOOD_WAKE.has(lastNight.wake_feeling ?? "") && (last3.avgHours ?? 0) >= 7) call = "push";
  else call = "normal";

  const avg = last3.avgHours != null && last3.nights > 1 ? ` 3-night average ${r1(last3.avgHours)} hours.` : "";
  const ln = lastNight ? `${r1(Number(lastNight.hours))} hours${lastNight.wake_feeling ? `, woke ${lastNight.wake_feeling}` : ""}.` : "";
  const line =
    call === "ease" ? `Ease off: ${reasons.join(", ")}. Keep the same weights, drop one set per lift, no PR attempts.`
    : call === "push" ? `Good to push: ${ln}${avg} Go for the planned increases.`
    : call === "normal" ? `Train as planned: ${ln}${avg} Hold off on big jumps until you wake rested.`
    : `No sleep logged for last night. Log it so the Coach can tell you whether to push or ease off.`;
  return { lastNight, last3, last7, call, reasons, line: line.replace(/\s+/g, " ").trim() };
}
