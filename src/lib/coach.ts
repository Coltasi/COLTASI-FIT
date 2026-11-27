import { getContext, getProgram, type Supa } from "@/lib/data";
import { daysBetween } from "@/lib/dates";
import { currentUser } from "@/lib/supabase/user";
import { getSteps, stepSummary } from "@/lib/steps";
import { fetchAll } from "@/lib/fetch-all";
import { groupExercises, type ExerciseRow } from "@/lib/exercise-match";
import { SKIP_LABEL, type SkipReason } from "@/lib/owed";
import { FEEL_LABEL, PAIN_LABEL, type Feel, type PainArea } from "@/lib/check-in";
import { praise } from "@/lib/praise";
import { kg, liftSignal, sleepSignal, splitDue, type DayDue, type LiftSignal, type Night, type Perf, type SleepSignal } from "@/lib/coach-signals";
import type { FoodRow, HistoryRow, Num, NightRow, WeighRow } from "@/lib/rows";

export const COACH_MODEL = "claude-haiku-4-5-20251001";

export type ReadKind = "session" | "weigh_in" | "scan";

/** kg per week from a least-squares fit over the given weigh-ins (oldest first or any order). */
export function weeklyRate(points: { measured_on: string; weight_kg: number }[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.measured_on < b.measured_on ? -1 : 1));
  const x = sorted.map((p) => daysBetween(sorted[0].measured_on, p.measured_on));
  const y = sorted.map((p) => Number(p.weight_kg));
  const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  const den = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  if (!den) return null;
  const slope = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / den;
  return slope * 7;
}

/** Days of history the weight trend uses everywhere (Progress, Coach tab, Coach reads). */
export const TREND_DAYS = 42;

/**
 * The one weight trend for the whole app: kg per week over the last six weeks of weigh-ins and scan weights.
 * Needs at least 3 points spanning 2 weeks, so a single odd weigh-in can't swing it.
 */
export function trendRate(points: { measured_on: string; weight_kg: number }[], today: string): number | null {
  const cutoff = new Date(Date.parse(today + "T12:00:00Z") - TREND_DAYS * 86400000).toISOString().slice(0, 10);
  const recent = points.filter((p) => p.measured_on >= cutoff && Number.isFinite(p.weight_kg)).sort((a, b) => (a.measured_on < b.measured_on ? -1 : 1));
  if (recent.length < 3 || daysBetween(recent[0].measured_on, recent.at(-1)!.measured_on) < 14) return null;
  return weeklyRate(recent);
}

/** Green or red: moving the right way at 70% of the target pace or better. null when there's no rate or target. */
export function onPace(rate: number | null, target: number | null): boolean | null {
  if (rate == null || target == null || target === 0) return null;
  return Math.sign(rate) === Math.sign(target) && Math.abs(rate) >= Math.abs(target) * 0.7;
}

/** Weigh-ins and scan weights from the trend window, as one list. */
export async function trendPoints(supabase: Supa, today: string) {
  const since = new Date(Date.parse(today + "T12:00:00Z") - TREND_DAYS * 86400000).toISOString().slice(0, 10);
  const [{ data: wis }, { data: scans }] = await Promise.all([
    supabase.from("weigh_ins").select("measured_on, weight_kg").gte("measured_on", since),
    supabase.from("scans").select("scanned_on, weight_kg").gte("scanned_on", since).not("weight_kg", "is", null),
  ]);
  return [
    ...((wis ?? []) as WeighRow[]).map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) })),
    ...((scans ?? []) as { scanned_on: string; weight_kg: Num }[]).map((r) => ({ measured_on: r.scanned_on, weight_kg: Number(r.weight_kg) })),
  ];
}

/** One Messages API call with the app's key. Returns the reply text, or null when there's no key or the call fails. */
export async function callClaude(body: { system?: string; max_tokens: number; messages: unknown[]; model?: string }): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ ...body, model: body.model ?? COACH_MODEL }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return typeof j?.content?.[0]?.text === "string" ? j.content[0].text : null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const daysAgo = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Everything the Coach knows, already computed. Stored with each read (coach_reads.signals). */
export type Signals = {
  kind: ReadKind;
  today: string;
  sessionTitle: string | null;
  /** Whose lifts the "Next session" calls are for: the session just finished, or the most overdue split day. */
  liftsFor: string | null;
  lifts: LiftSignal[];
  /** What the user told the Coach at the end of the session just finished (all optional). */
  checkIn?: { feel: Feel | null; pains: string[]; note: string | null; repeats: { area: string; times30d: number }[] } | null;
  /** Lifts skipped in the session just finished, and why. */
  skipped?: { lift: string; reason: string }[];
  splitDue: DayDue[];
  sleep: SleepSignal;
  /** Only on weigh-in and scan reads. */
  weight: { lines: string[]; latestKg: number | null; rateKgWeek: number | null; targetKgWeek: number | null; behind: boolean } | null;
  /** Workout reads only: drinks logged the day before this session, and how sleep looks after drinking (last 30 days). */
  drinks?: { lastNight: number; sleepAfter: number | null; sleepOther: number | null; nights30: number } | null;
};

/** A day with this many calories logged counts as fully logged (same bar as the Food page). */
const FULL_DAY_KCAL = 1000;

/** Drinks logged the day before a session, plus sleep on drinking nights vs other nights over the last 30 days. */
async function drinkSignal(supabase: Supa, sessionDate: string): Promise<Signals["drinks"]> {
  const since = daysAgo(sessionDate, 30);
  const [{ data: d }, { data: nights }] = await Promise.all([
    supabase.from("food_logs").select("day, drinks").eq("source", "drink").gte("day", since).lte("day", sessionDate),
    supabase.from("sleep_logs").select("night_of, hours").gte("night_of", since).lte("night_of", sessionDate),
  ]);
  const perDay = new Map<string, number>();
  for (const r of (d ?? []) as { day: string; drinks: number | null }[]) perDay.set(r.day, (perDay.get(r.day) ?? 0) + (r.drinks ?? 1));
  const lastNight = perDay.get(daysAgo(sessionDate, 1)) ?? 0;
  if (!lastNight) return null;
  const after: number[] = [], other: number[] = [];
  for (const n of (nights ?? []) as { night_of: string; hours: Num }[]) (perDay.has(n.night_of) ? after : other).push(Number(n.hours));
  const avg = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return { lastNight, sleepAfter: after.length >= 2 ? avg(after) : null, sleepOther: other.length >= 3 ? avg(other) : null, nights30: perDay.size };
}

export async function gatherSignals(supabase: Supa, kind: ReadKind, sourceId?: string): Promise<Signals> {
  const user = await currentUser(supabase);
  const { today } = await getContext();
  const [{ data: prof }, { data: exRows }, program, { data: nights }, { data: splitSessions }, history] = await Promise.all([
    supabase.from("profiles").select("target_rate_kg_week, target_kcal, kettlebells_kg").eq("id", user?.id ?? "").single(),
    supabase.from("exercises").select("id, name, modality, created_by, created_at"),
    getProgram(supabase),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags").order("night_of", { ascending: false }).limit(14),
    supabase.from("sessions").select("day_id, session_date").eq("status", "done").eq("kind", "split").not("day_id", "is", null).order("session_date", { ascending: false }).limit(200),
    fetchAll((a, b) => supabase
      .from("session_exercises")
      .select("id, exercise_id, sessions!inner(session_date, status, started_at), session_sets(set_no, weight_kg, reps, done, effort)")
      .eq("sessions.status", "done")
      .order("id")
      .range(a, b)
      .overrideTypes<HistoryRow[], { merge: false }>()),
  ]);
  const kettlebells = ((prof?.kettlebells_kg as number[] | null) ?? [8, 12, 16, 20, 24, 30]).map(Number);

  // History grouped by exercise (synonyms like "KB Swing" / "Kettlebell Swing" are one lift), oldest first.
  const { keyById } = groupExercises((exRows ?? []) as ExerciseRow[]);
  const modality = new Map(((exRows ?? []) as { id: string; modality: string | null }[]).map((e) => [e.id, e.modality]));
  const keyOf = (id: string) => keyById.get(id) ?? id;
  const perfs = new Map<string, Perf[]>();
  for (const r of [...history].sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? -1 : 1))) {
    const sets = (r.session_sets ?? []).filter((s) => s.done).sort((a, b) => a.set_no - b.set_no)
      .map((s) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps, effort: s.effort ?? null }));
    if (!sets.length) continue;
    const k = keyOf(r.exercise_id);
    if (!perfs.has(k)) perfs.set(k, []);
    perfs.get(k)!.push({ date: r.sessions.session_date, sets });
  }

  // Split days, most overdue first.
  const lastDone = new Map<string, string>();
  for (const s of (splitSessions ?? []) as { day_id: string; session_date: string }[]) if (!lastDone.has(s.day_id)) lastDone.set(s.day_id, s.session_date);
  const due = splitDue(program.filter((d) => d.program === "split"), lastDone, today);

  const sleep = sleepSignal(((nights ?? []) as NightRow[]).map((n) => ({ ...n, hours: Number(n.hours), flags: n.flags ?? [] })) as Night[], today);
  let ease = sleep.call === "ease";

  // Which lifts get a call: the session just finished, or the most overdue split day.
  let sessionTitle: string | null = null;
  let liftsFor: string | null = null;
  let plan: { exercise_id: string; name: string; rep_range: string | null }[] = [];
  let skipped: { lift: string; reason: string }[] = [];
  let checkIn: Signals["checkIn"] = null;
  let easeWhy: "sleep" | "sick" = "sleep";
  let drinks: Signals["drinks"] = null;
  if (kind === "session" && sourceId) {
    const { data: s } = await supabase
      .from("sessions")
      .select("title, session_date, feel, pain_areas, notes, session_exercises(exercise_id, position, rep_range, skipped_reason, skill, exercises(name))")
      .eq("id", sourceId)
      .single();
    sessionTitle = s?.title ?? null;
    if (s?.session_date) drinks = await drinkSignal(supabase, s.session_date as string);
    const pains = ((s?.pain_areas ?? []) as string[]);
    if (s?.feel || pains.length || s?.notes) {
      // Same niggle flagged again in the last 30 days (this session included)?
      let repeats: { area: string; times30d: number }[] = [];
      if (pains.length) {
        const since = new Date(new Date(today + "T12:00:00Z").getTime() - 30 * 864e5).toISOString().slice(0, 10);
        const { data: recent } = await supabase.from("sessions").select("pain_areas").eq("status", "done").gte("session_date", since).overlaps("pain_areas", pains);
        repeats = pains.map((p) => ({
          area: PAIN_LABEL[p as PainArea] ?? p,
          times30d: Math.max(1, ((recent ?? []) as { pain_areas: string[] | null }[]).filter((r) => (r.pain_areas ?? []).includes(p)).length),
        }));
      }
      checkIn = { feel: (s?.feel as Feel | null) ?? null, pains: pains.map((p) => PAIN_LABEL[p as PainArea] ?? p), note: s?.notes ?? null, repeats };
      if (s?.feel === "sick") { ease = true; easeWhy = "sick"; }
    }
    liftsFor = sessionTitle;
    const rows = ((s?.session_exercises ?? []) as unknown as { exercise_id: string; position: number; rep_range: string | null; skipped_reason: string | null; skill: boolean; exercises: { name: string } | null }[]).filter((x) => !x.skill);
    skipped = rows.filter((x) => x.skipped_reason).map((x) => ({ lift: x.exercises?.name ?? "", reason: SKIP_LABEL[x.skipped_reason as SkipReason] ?? x.skipped_reason }));
    plan = rows.sort((a, b) => a.position - b.position)
      .map((x) => ({ exercise_id: x.exercise_id, name: x.exercises?.name ?? "", rep_range: x.rep_range }));
  } else if (due.length) {
    const day = program.find((d) => d.name === due[0].name && d.program === "split");
    liftsFor = day?.name ?? null;
    plan = (day?.exercises ?? []).map((x) => ({ exercise_id: x.exercise_id, name: x.name, rep_range: x.rep_range || null }));
  }
  const lifts = plan
    .map((p) => liftSignal({ name: p.name, modality: modality.get(p.exercise_id) ?? null, repRange: p.rep_range, history: perfs.get(keyOf(p.exercise_id)) ?? [] }, kettlebells, ease, easeWhy))
    .filter((x): x is LiftSignal => x != null);

  // Weight: only on weigh-in and scan reads.
  let weight: Signals["weight"] = null;
  if (kind !== "session") {
    const [pts, stepRows, { data: scans }, { data: food }] = await Promise.all([
      trendPoints(supabase, today),
      getSteps(supabase, today, 14),
      supabase.from("scans").select("scanned_on, weight_kg, body_fat_pct, muscle_mass_kg").order("scanned_on", { ascending: false }).limit(2),
      supabase.from("food_logs").select("day, kcal, source, drinks").gte("day", daysAgo(today, 7)).lt("day", today),
    ]);
    pts.sort((x, y) => (x.measured_on < y.measured_on ? 1 : -1));
    const rate = trendRate(pts, today);
    const target = prof?.target_rate_kg_week == null ? null : Number(prof.target_rate_kg_week);
    const behind = onPace(rate, target) === false;
    const lines: string[] = [];
    if (kind === "scan" && scans?.length) {
      const [a, b] = scans as { scanned_on: string; weight_kg: Num | null; body_fat_pct: Num | null; muscle_mass_kg: Num | null }[];
      const part = (v: Num | null, pv: Num | null | undefined, label: string, u: string) =>
        v == null ? null : `${label} ${r1(Number(v))}${u}${pv != null ? ` (${Number(v) - Number(pv) >= 0 ? "up" : "down"} ${r1(Math.abs(Number(v) - Number(pv)))}${u} since ${b.scanned_on})` : ""}`;
      const bits = [part(a.body_fat_pct, b?.body_fat_pct, "Body fat", "%"), part(a.muscle_mass_kg, b?.muscle_mass_kg, "muscle", " kg")].filter(Boolean);
      if (bits.length) lines.push(`Scan: ${bits.join(", ")}.`);
    }
    // Last 7 full days of food (today excluded): days over the calorie target, and what drinks added.
    const tK = prof?.target_kcal == null ? null : Number(prof.target_kcal);
    const byDay = new Map<string, number>();
    let drinkKcal = 0;
    for (const r of (food ?? []) as { day: string; kcal: Num; source: string }[]) {
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.kcal));
      if (r.source === "drink") drinkKcal += Number(r.kcal);
    }
    const full = [...byDay].filter(([, k]) => k >= FULL_DAY_KCAL).sort();
    const over = tK ? full.filter(([, k]) => k > tK * 1.05) : [];
    const dow = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
    if (rate != null && target != null) {
      const ss = stepSummary(stepRows, today);
      const stepsFell = ss.avg7 != null && ss.avgPrev7 != null && ss.avg7 < ss.avgPrev7 * 0.85;
      lines.push(`${rate <= 0 ? "Losing" : "Gaining"} ${r1(Math.abs(rate))} kg a week over six weeks, against a ${r1(Math.abs(target))} kg target.` +
        (!behind ? ` On track. ${praise(today + kind)}, keep it locked in.`
          : over.length >= 2 ? ` You were over your calories on ${over.length} of the last ${full.length} full days. No guilt: you can get back on track, just start today.`
          : stepsFell ? ` Steps fell from ${ss.avgPrev7!.toLocaleString("en-US")} to ${ss.avg7!.toLocaleString("en-US")} a day; get those back first.`
          : full.length >= 4 ? " Your logged calories look on target, so keep going: give it 2 more weeks before cutting calories."
          : " Log your food every day this week so I can see what's holding it up."));
    } else if (pts.length) lines.push(`Latest weigh-in ${kg(pts[0].weight_kg)}.`);
    if (tK && full.length >= 3) {
      lines.push(over.length
        ? `Over ${tK.toLocaleString("en-US")} kcal on ${over.length} of ${full.length} full days (${over.map(([d]) => dow(d)).join(", ")}).`
        : `On or under ${tK.toLocaleString("en-US")} kcal on all ${full.length} full days. Good.`);
    }
    if (drinkKcal >= 100) lines.push(`Drinks added about ${Math.round(drinkKcal / 10) * 10} kcal this week.`);
    weight = { lines, latestKg: pts[0]?.weight_kg ?? null, rateKgWeek: rate == null ? null : r1(rate), targetKgWeek: target, behind };
  }

  return { kind, today, sessionTitle, liftsFor, lifts, skipped, checkIn, splitDue: due.slice(0, 4), sleep, weight, drinks };
}

export type Read = { headline: string; next_session: string | null; recovery: string | null; weight: string | null };

function nextUpLine(s: Signals): string | null {
  const d = s.splitDue[0];
  if (!d) return null;
  return d.daysSince == null ? `Next up: ${d.name} (not done yet).` : `Next up: ${d.name}, last done ${d.daysSince} day${d.daysSince === 1 ? "" : "s"} ago.`;
}

/** Lifts that went heavier or lighter than the session before, from the session just finished. */
function moves(s: Signals) {
  const withKg = s.lifts.filter((l) => l.change?.kg != null && l.change.kg !== 0 && l.change.from != null && l.top != null);
  return {
    heavier: withKg.filter((l) => (l.change!.kg as number) > 0).map((l) => ({ lift: l.name, from: l.change!.from, to: l.top })),
    lighter: withKg.filter((l) => (l.change!.kg as number) < 0).map((l) => ({ lift: l.name, from: l.change!.from, to: l.top })),
  };
}

/** One sentence on a flagged niggle; a repeat in the last month gets a nudge to have it checked. */
function painLine(ci: Signals["checkIn"]): string | null {
  if (!ci?.repeats.length) return null;
  const worst = [...ci.repeats].sort((a, b) => b.times30d - a.times30d)[0];
  if (worst.times30d >= 3) return `That's ${worst.times30d} times this month you've flagged ${worst.area === "Other" ? "that niggle" : `your ${worst.area.toLowerCase()}`}. Worth getting it looked at by a physio.`;
  const areas = ci.pains.map((p) => p.toLowerCase()).filter((a) => a !== "other");
  if (!areas.length) return "Go easy on whatever's niggling you next time. If it's still there, swap out whatever aggravates it.";
  const list = areas.length > 1 ? `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}` : areas[0];
  return `Go easy on your ${list} next time. If it's still there, swap out whatever aggravates it.`;
}

/** Two short coach-voice sentences reacting to the session, built in code. */
function ruleNote(s: Signals, up: LiftSignal[], stalled: LiftSignal[]): string | null {
  if (s.kind !== "session") return null;
  const { heavier, lighter } = moves(s);
  const first: string[] = [];
  const ci = s.checkIn;
  const offDay = ci?.feel === "sick" || ci?.feel === "low";
  const dr = s.drinks;
  if (ci?.feel === "sick") first.push("Good job showing up while sick. Rest up, and don't chase weights until you're over it.");
  else if (ci?.feel === "low") first.push("Low-energy day, and you still got it done. That counts.");
  const pain = painLine(ci);
  if (pain) first.push(pain);
  if (first.length >= 2) return first.slice(0, 2).join(" ");
  if (heavier.length) first.push(`${praise(s.today + (s.sessionTitle ?? ""))}. ${heavier[0].lift} went up to ${kg(heavier[0].to as number)}${heavier.length > 1 ? `, and ${heavier.length - 1} more lift${heavier.length > 2 ? "s" : ""} went heavier too` : ""}.`);
  else if (up.length) first.push(`Great session. You're ready to go up on ${up[0].name}. You've got this.`);
  if (dr && !offDay) first.unshift(`You showed up after ${dr.lastNight} drink${dr.lastNight === 1 ? "" : "s"} last night. Good.${lighter.length ? ` It showed on ${lighter[0].lift}.` : ""}`);
  else if (lighter.length && !offDay) first.push(`I noticed you went lighter on ${lighter[0].lift} today. Everything okay?`);
  else if (stalled.length) first.push(`${stalled[0].name} has been stuck a while. Lock in, let's break through it.`);
  const sk = s.skipped ?? [];
  if (first.length < 2 && sk.length) first.push(sk.length === 1
    ? `You skipped ${sk[0].lift} (${sk[0].reason}). I'll remind you to fit it in this week.`
    : `You skipped ${sk.length} lifts today. I'll remind you to fit them in this week.`);
  if (!first.length) first.push(s.sleep.call === "ease" ? "Good job showing up on a rough night. Take it easy next time." : `${praise(s.today + "show")}. You showed up. Next time, lock in and chase one more rep per set.`);
  return first.slice(0, 2).join(" ");
}

/** The read built straight from the signals. Also the fallback for any field the model gets wrong. */
export function ruleRead(s: Signals): Read {
  const up = s.lifts.filter((l) => l.call === "up");
  const stalled = s.lifts.filter((l) => l.call === "back_off");
  let headline: string;
  const note = ruleNote(s, up, stalled);
  if (note) headline = note;
  else if (s.kind !== "session" && s.weight?.lines.length) headline = s.weight.lines[s.weight.lines.length - 1].split(". ")[0].replace(/\.$/, "") + ".";
  else if (s.sleep.call === "ease") headline = `Ease off next session: ${s.sleep.reasons[0]}.`;
  else if (up.length) headline = up.length === 1 ? `${up[0].name} is ready to go up next time.` : `${up.length} lifts are ready to go up: ${up.slice(0, 3).map((l) => l.name).join(", ")}.`;
  else if (stalled.length) headline = `${stalled[0].name} has stalled for ${stalled[0].stalledFor} sessions. Time to back off or swap it.`;
  else headline = nextUpLine(s) ?? `${s.sessionTitle ?? "Session"} logged.`;

  const lines = s.lifts.map((l) => l.line);
  const head = s.kind === "session" ? (s.liftsFor ? `Next time you do ${s.liftsFor}:` : null) : s.liftsFor ? `For ${s.liftsFor}:` : null;
  const next = [nextUpLine(s), lines.length ? [head, ...lines].filter(Boolean).join("\n") : null].filter(Boolean).join("\n\n");
  return {
    headline,
    next_session: next || null,
    recovery: s.checkIn?.feel === "sick"
      ? "Ease off next session until you're better: keep the same weights, drop one set per lift, no PR attempts. Skip it entirely if it's in your chest."
      : s.drinks && s.drinks.sleepAfter != null && s.drinks.sleepOther != null && s.drinks.sleepAfter < s.drinks.sleepOther - 0.3
      ? `Your sleep after drinking averages ${s.drinks.sleepAfter} h, against ${s.drinks.sleepOther} h without. If you're drinking, put it before a rest day.`
      : s.sleep.line,
    weight: s.kind !== "session" && s.weight?.lines.length ? s.weight.lines.join(" ") : null,
  };
}

/** Every number in `text` must appear somewhere in the facts we gave the model. */
function numbersOk(text: string, facts: string) {
  const allowed = new Set((facts.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))));
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(String(Number(n))));
}
const WEIGHT_TALK = /weigh|weight loss|kg\s*(a|per|\/)\s*week|calori|kcal|deficit|scale/i;

/**
 * The model rewords the headline and recovery advice from finished facts. The per-lift calls are
 * never sent through the model: they are written in code, so they can't come out wrong.
 */
async function polish(s: Signals, base: Read): Promise<{ read: Read; model: string }> {
  const facts = {
    readType: s.kind,
    workout: s.sessionTitle,
    liftCalls: s.lifts.map((l) => ({ lift: l.name, call: l.call, instruction: l.line })),
    ...(s.kind === "session" ? moves(s) : {}),
    skipped: s.skipped ?? [],
    checkIn: s.checkIn ? { feel: s.checkIn.feel ? FEEL_LABEL[s.checkIn.feel] : null, pains: s.checkIn.pains, note: s.checkIn.note, painRepeats: s.checkIn.repeats } : null,
    nextUp: nextUpLine(s),
    sleep: { call: s.sleep.call, reasons: s.sleep.reasons, advice: s.sleep.line },
    drinksLastNight: s.drinks?.lastNight ?? null,
    weight: s.kind === "session" ? null : s.weight?.lines ?? null,
    draftHeadline: base.headline,
    draftRecovery: base.recovery,
  };
  const factsText = JSON.stringify(facts);
  const text = await callClaude({
    max_tokens: 300,
    system:
      "You are the coach in a personal training app, talking to one person you train. Encouraging, warm, direct and human, like a good personal trainer who believes in them: praise real wins, varying the wording every time (\"Nice work\", \"Well done\", \"Strong work\", \"Big win\", \"Nailed it\", \"That's how it's done\"; say \"Great work\" rarely, at most once in a read), fire them up (\"Lock in\", \"You've got this\"), push when it's earned (\"Come on, you can do better\"), and check in when something looks off. " +
      "If something slipped (a lighter lift, a skipped lift, a missed day), never guilt them: tell them they can get back on track and to just start now. " +
      "Tie praise to something they actually did, and don't use the same rally phrase twice in one read. " +
      "If `skipped` has lifts, say briefly that you'll remind them to come back to it (if sore, tell them to let it recover first). " +
      "`checkIn` is what they told you at the end of this workout (how they felt, any pain, a note). If they were sick or low on energy, acknowledge it warmly, praise them for showing up, and do NOT ask why a lift was lighter: you already know. If they flagged pain, name the area and tell them to go easy on it; if painRepeats shows 3 or more times in 30 days, suggest a physio or doctor. Never diagnose. Respond to anything specific in the note. " +
      "If `drinksLastNight` is set, mention once, without lecturing, that they trained after drinking, and if a lift is in `lighter` that the drinks likely explain it (so don't ask why). " +
      "If a lift is in `lighter` and they didn't explain it in checkIn, ask about it kindly, e.g. \"I noticed you went lighter on Seated Row today. Everything okay?\". If lifts are in `heavier`, call out the best one. " +
      "You are given conclusions that are already worked out. Never compare numbers yourself, never add numbers that are not in the facts, never change a call (up, hold, back_off, ease, push). " +
      "Priorities: training first, then sleep and recovery, then body weight. " +
      (s.kind === "session"
        ? "This read is after a workout: the headline must be about this workout or recovery and must not mention body weight, calories or the scale. Do not list every lift; pick the one or two things that matter most. "
        : "This read is after a weigh-in or body scan: the headline may mention weight, in one short sentence. ") +
      "Plain words, full exercise names, no gym shorthand, no emoji, no em dashes. " +
      'Reply with JSON only: {"headline": the coach talking, two or three short sentences, each under 14 words, under 35 words in total, each sentence one separate point (they are shown as bullet points), "recovery": one or two sentences saying whether to push or ease off next session and why, keeping the same call as draftRecovery}.',
    messages: [{ role: "user", content: factsText }],
  });
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return { read: base, model: "rules" };
  let j: { headline?: unknown; recovery?: unknown };
  try { j = JSON.parse(m[0]); } catch { return { read: base, model: "rules" }; }
  const ok = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && numbersOk(v, factsText) && !/—/.test(v);
  const headline = ok(j.headline) && !(s.kind === "session" && WEIGHT_TALK.test(j.headline)) ? j.headline.trim() : base.headline;
  const recovery = ok(j.recovery) && !WEIGHT_TALK.test(j.recovery) ? j.recovery.trim() : base.recovery;
  const used = headline !== base.headline || recovery !== base.recovery;
  return { read: { ...base, headline, recovery }, model: used ? COACH_MODEL : "rules" };
}

export async function buildCoachRead(supabase: Supa, kind: ReadKind, sourceId?: string) {
  const signals = await gatherSignals(supabase, kind, sourceId);
  const base = ruleRead(signals);
  let out = { read: base, model: "rules" };
  try { out = await polish(signals, base); } catch {}
  return { ...out, signals };
}

export async function writeCoachRead(supabase: Supa, { kind, sourceId }: { kind: ReadKind; sourceId?: string }) {
  const { read, model, signals } = await buildCoachRead(supabase, kind, sourceId);
  const { error } = await supabase.from("coach_reads").insert({ kind, source_id: sourceId ?? null, model, ...read, lifting: null, signals });
  if (error) throw new Error(error.message);
}

export async function askCoach(supabase: Supa, question: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "Coach can't answer questions yet: the Anthropic API key hasn't been added to the app's settings on Vercel.";
  const signals = await gatherSignals(supabase, "weigh_in");
  const { data: recent } = await supabase.from("sessions").select("title, session_date, status, feel, pain_areas, notes").order("started_at", { ascending: false }).limit(8);
  const { data: food } = await supabase.from("food_logs").select("day, kcal, protein_g, source, drinks").gte("day", daysAgo(signals.today, 7));
  const me = await currentUser(supabase);
  const { data: prof } = await supabase.from("profiles").select("target_kcal, protein_g, tdee_kcal").eq("id", me?.id ?? "").maybeSingle();
  const byDay = new Map<string, { kcal: number; protein_g: number }>();
  for (const r of (food ?? []) as FoodRow[]) {
    const t = byDay.get(r.day) ?? { kcal: 0, protein_g: 0 };
    t.kcal += Number(r.kcal); t.protein_g += Math.round(Number(r.protein_g));
    byDay.set(r.day, t);
  }
  const drinksLast7 = ((food ?? []) as { day: string; source?: string; drinks?: number | null }[]).filter((r) => r.source === "drink").map((r) => ({ day: r.day, drinks: r.drinks ?? 1 }));
  const foodLast7 = { targets: prof ?? null, days: [...byDay].sort().map(([day, t]) => ({ day, ...t })), drinks: drinksLast7 };
  const text = await callClaude({
    max_tokens: 500,
    system: "You are the coach in a personal training app. Answer in under 120 words, plainly and encouragingly, using the user's data. Be on their side: their goal is to lose fat and build muscle; if they slipped, tell them they can get back on track and to just start now. The lift calls, sleep call and weight trend are already worked out: use them as given and never redo the math or invent numbers. Training and sleep come before body weight. No emoji, no em dashes. You are not a doctor; for pain or injury, say to see one.",
    messages: [{ role: "user", content: `My data: ${JSON.stringify({ ...signals, recentSessions: recent, foodLast7 })}\n\nQuestion: ${question}` }],
  });
  return text ?? "Coach couldn't answer just now. Try again in a minute.";
}
