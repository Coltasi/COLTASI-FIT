import { getContext, getProgram, type Supa } from "@/lib/data";
import { daysBetween } from "@/lib/dates";
import { currentUser } from "@/lib/supabase/user";
import { getSteps, stepSummary } from "@/lib/steps";
import { fetchAll } from "@/lib/fetch-all";
import { groupExercises, type ExerciseRow } from "@/lib/exercise-match";
import { SKIP_LABEL, type SkipReason } from "@/lib/owed";
import { FEEL_LABEL, PAIN_LABEL, type Feel, type PainArea } from "@/lib/check-in";
import { kg, liftSignal, sleepSignal, splitDue, type DayDue, type LiftSignal, type Night, type Perf, type SleepSignal } from "@/lib/coach-signals";

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
};

export async function gatherSignals(supabase: Supa, kind: ReadKind, sourceId?: string): Promise<Signals> {
  const user = await currentUser(supabase);
  const { today } = await getContext();
  const [{ data: prof }, { data: exRows }, program, { data: nights }, { data: splitSessions }, history] = await Promise.all([
    supabase.from("profiles").select("target_rate_kg_week, target_kcal, kettlebells_kg").eq("id", user?.id ?? "").single(),
    supabase.from("exercises").select("id, name, modality, created_by, created_at"),
    getProgram(supabase),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags").order("night_of", { ascending: false }).limit(14),
    supabase.from("sessions").select("day_id, session_date").eq("status", "done").eq("kind", "split").not("day_id", "is", null).order("session_date", { ascending: false }).limit(200),
    fetchAll<any>((a, b) => supabase
      .from("session_exercises")
      .select("id, exercise_id, sessions!inner(session_date, status, started_at), session_sets(set_no, weight_kg, reps, done)")
      .eq("sessions.status", "done")
      .order("id")
      .range(a, b)),
  ]);
  const kettlebells = ((prof?.kettlebells_kg as number[] | null) ?? [8, 12, 16, 20, 24, 30]).map(Number);

  // History grouped by exercise (synonyms like "KB Swing" / "Kettlebell Swing" are one lift), oldest first.
  const { keyById } = groupExercises((exRows ?? []) as ExerciseRow[]);
  const modality = new Map(((exRows ?? []) as any[]).map((e) => [e.id, e.modality as string | null]));
  const keyOf = (id: string) => keyById.get(id) ?? id;
  const perfs = new Map<string, Perf[]>();
  for (const r of [...history].sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? -1 : 1))) {
    const sets = (r.session_sets ?? []).filter((s: any) => s.done).sort((a: any, b: any) => a.set_no - b.set_no)
      .map((s: any) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps }));
    if (!sets.length) continue;
    const k = keyOf(r.exercise_id);
    if (!perfs.has(k)) perfs.set(k, []);
    perfs.get(k)!.push({ date: r.sessions.session_date, sets });
  }

  // Split days, most overdue first.
  const lastDone = new Map<string, string>();
  for (const s of (splitSessions ?? []) as any[]) if (!lastDone.has(s.day_id)) lastDone.set(s.day_id, s.session_date);
  const due = splitDue(program.filter((d) => d.program === "split"), lastDone, today);

  const sleep = sleepSignal(((nights ?? []) as any[]).map((n) => ({ ...n, hours: Number(n.hours), flags: n.flags ?? [] })) as Night[], today);
  let ease = sleep.call === "ease";

  // Which lifts get a call: the session just finished, or the most overdue split day.
  let sessionTitle: string | null = null;
  let liftsFor: string | null = null;
  let plan: { exercise_id: string; name: string; rep_range: string | null }[] = [];
  let skipped: { lift: string; reason: string }[] = [];
  let checkIn: Signals["checkIn"] = null;
  let easeWhy: "sleep" | "sick" = "sleep";
  if (kind === "session" && sourceId) {
    const { data: s } = await supabase
      .from("sessions")
      .select("title, feel, pain_areas, notes, session_exercises(exercise_id, position, rep_range, skipped_reason, skill, exercises(name))")
      .eq("id", sourceId)
      .single();
    sessionTitle = s?.title ?? null;
    const pains = ((s?.pain_areas ?? []) as string[]);
    if (s?.feel || pains.length || s?.notes) {
      // Same niggle flagged again in the last 30 days (this session included)?
      let repeats: { area: string; times30d: number }[] = [];
      if (pains.length) {
        const since = new Date(new Date(today + "T12:00:00Z").getTime() - 30 * 864e5).toISOString().slice(0, 10);
        const { data: recent } = await supabase.from("sessions").select("pain_areas").eq("status", "done").gte("session_date", since).overlaps("pain_areas", pains);
        repeats = pains.map((p) => ({
          area: PAIN_LABEL[p as PainArea] ?? p,
          times30d: Math.max(1, ((recent ?? []) as any[]).filter((r) => (r.pain_areas ?? []).includes(p)).length),
        }));
      }
      checkIn = { feel: (s?.feel as Feel | null) ?? null, pains: pains.map((p) => PAIN_LABEL[p as PainArea] ?? p), note: s?.notes ?? null, repeats };
      if (s?.feel === "sick") { ease = true; easeWhy = "sick"; }
    }
    liftsFor = sessionTitle;
    const rows = ((s?.session_exercises ?? []) as any[]).filter((x) => !x.skill);
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
    const [{ data: wis }, stepRows, { data: scans }] = await Promise.all([
      supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(6),
      getSteps(supabase, today, 14),
      supabase.from("scans").select("scanned_on, weight_kg, body_fat_pct, muscle_mass_kg").order("scanned_on", { ascending: false }).limit(2),
    ]);
    const pts = ((wis ?? []) as any[]).map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) }));
    const rate = weeklyRate(pts.slice(0, 4));
    const target = prof?.target_rate_kg_week == null ? null : Number(prof.target_rate_kg_week);
    const behind = rate != null && target != null && (target < 0 ? rate > target * 0.75 : rate < target * 0.75);
    const lines: string[] = [];
    if (kind === "scan" && scans?.length) {
      const [a, b] = scans as any[];
      const part = (v: any, pv: any, label: string, u: string) =>
        v == null ? null : `${label} ${r1(Number(v))}${u}${pv != null ? ` (${Number(v) - Number(pv) >= 0 ? "up" : "down"} ${r1(Math.abs(Number(v) - Number(pv)))}${u} since ${b.scanned_on})` : ""}`;
      const bits = [part(a.body_fat_pct, b?.body_fat_pct, "Body fat", "%"), part(a.muscle_mass_kg, b?.muscle_mass_kg, "muscle", " kg")].filter(Boolean);
      if (bits.length) lines.push(`Scan: ${bits.join(", ")}.`);
    }
    if (rate != null && target != null) {
      const ss = stepSummary(stepRows, today);
      const stepsFell = ss.avg7 != null && ss.avgPrev7 != null && ss.avg7 < ss.avgPrev7 * 0.85;
      lines.push(`Losing ${r1(Math.abs(rate))} kg a week against a ${r1(Math.abs(target))} kg target.` +
        (!behind ? " On track." : stepsFell ? ` Steps fell from ${ss.avgPrev7!.toLocaleString("en-US")} to ${ss.avg7!.toLocaleString("en-US")} a day; get those back first.` : " Sleep and training come first; change calories only after 2 more flat weeks."));
    } else if (pts.length) lines.push(`Latest weigh-in ${kg(pts[0].weight_kg)}.`);
    weight = { lines, latestKg: pts[0]?.weight_kg ?? null, rateKgWeek: rate == null ? null : r1(rate), targetKgWeek: target, behind };
  }

  return { kind, today, sessionTitle, liftsFor, lifts, skipped, checkIn, splitDue: due.slice(0, 4), sleep, weight };
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
  if (worst.times30d >= 3) return `That's ${worst.times30d} times this month you've flagged your ${worst.area.toLowerCase()}. Worth getting it looked at by a physio.`;
  const areas = ci.pains.map((p) => p.toLowerCase());
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
  if (ci?.feel === "sick") first.push("Good job showing up while sick. Rest up, and don't chase weights until you're over it.");
  else if (ci?.feel === "low") first.push("Low-energy day, and you still got it done. That counts.");
  const pain = painLine(ci);
  if (pain) first.push(pain);
  if (first.length >= 2) return first.slice(0, 2).join(" ");
  if (heavier.length) first.push(`Great work. ${heavier[0].lift} went up to ${kg(heavier[0].to as number)}${heavier.length > 1 ? `, and ${heavier.length - 1} more lift${heavier.length > 2 ? "s" : ""} went heavier too` : ""}.`);
  else if (up.length) first.push(`Solid session. You're ready to go up on ${up[0].name}.`);
  if (lighter.length && !offDay) first.push(`I noticed you went lighter on ${lighter[0].lift} today. Everything okay?`);
  else if (stalled.length) first.push(`${stalled[0].name} has been stuck a while. Come on, let's break through it.`);
  const sk = s.skipped ?? [];
  if (first.length < 2 && sk.length) first.push(sk.length === 1
    ? `You skipped ${sk[0].lift} (${sk[0].reason}). I'll remind you to fit it in this week.`
    : `You skipped ${sk.length} lifts today. I'll remind you to fit them in this week.`);
  if (!first.length) first.push(s.sleep.call === "ease" ? "Good job showing up on a rough night. Take it easy next time." : "Session logged. Next time, chase one more rep per set.");
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
    weight: s.kind === "session" ? null : s.weight?.lines ?? null,
    draftHeadline: base.headline,
    draftRecovery: base.recovery,
  };
  const factsText = JSON.stringify(facts);
  const text = await callClaude({
    max_tokens: 300,
    system:
      "You are the coach in a personal training app, talking to one person you train. Warm, direct and human, like a good personal trainer: praise real wins (\"Great work\"), push when it's earned (\"Come on, you can do better\"), and check in when something looks off. " +
      "If `skipped` has lifts, say briefly that you'll remind them to come back to it (if sore, tell them to let it recover first). " +
      "`checkIn` is what they told you at the end of this workout (how they felt, any pain, a note). If they were sick or low on energy, acknowledge it warmly, praise them for showing up, and do NOT ask why a lift was lighter: you already know. If they flagged pain, name the area and tell them to go easy on it; if painRepeats shows 3 or more times in 30 days, suggest a physio or doctor. Never diagnose. Respond to anything specific in the note. " +
      "If a lift is in `lighter` and they didn't explain it in checkIn, ask about it kindly, e.g. \"I noticed you went lighter on Seated Row today. Everything okay?\". If lifts are in `heavier`, call out the best one. " +
      "You are given conclusions that are already worked out. Never compare numbers yourself, never add numbers that are not in the facts, never change a call (up, hold, back_off, ease, push). " +
      "Priorities: training first, then sleep and recovery, then body weight. " +
      (s.kind === "session"
        ? "This read is after a workout: the headline must be about this workout or recovery and must not mention body weight, calories or the scale. Do not list every lift; pick the one or two things that matter most. "
        : "This read is after a weigh-in or body scan: the headline may mention weight, in one short sentence. ") +
      "Plain words, full exercise names, no gym shorthand, no hype, no emoji, no em dashes. " +
      'Reply with JSON only: {"headline": the coach talking, two short sentences, under 35 words in total, "recovery": one or two sentences saying whether to push or ease off next session and why, keeping the same call as draftRecovery}.',
    messages: [{ role: "user", content: factsText }],
  });
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return { read: base, model: "rules" };
  let j: any;
  try { j = JSON.parse(m[0]); } catch { return { read: base, model: "rules" }; }
  const ok = (v: unknown) => typeof v === "string" && v.trim().length > 0 && numbersOk(v, factsText) && !/—/.test(v);
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
  const { data: food } = await supabase.from("food_logs").select("day, kcal, protein_g").gte("day", daysAgo(signals.today, 7));
  const me = await currentUser(supabase);
  const { data: prof } = await supabase.from("profiles").select("target_kcal, protein_g, tdee_kcal").eq("id", me?.id ?? "").maybeSingle();
  const byDay = new Map<string, { kcal: number; protein_g: number }>();
  for (const r of (food ?? []) as any[]) {
    const t = byDay.get(r.day) ?? { kcal: 0, protein_g: 0 };
    t.kcal += Number(r.kcal); t.protein_g += Math.round(Number(r.protein_g));
    byDay.set(r.day, t);
  }
  const foodLast7 = { targets: prof ?? null, days: [...byDay].sort().map(([day, t]) => ({ day, ...t })) };
  const text = await callClaude({
    max_tokens: 500,
    system: "You are the coach in a personal training app. Answer in under 120 words, plainly, using the user's data. The lift calls, sleep call and weight trend are already worked out: use them as given and never redo the math or invent numbers. Training and sleep come before body weight. No emoji, no em dashes. You are not a doctor; for pain or injury, say to see one.",
    messages: [{ role: "user", content: `My data: ${JSON.stringify({ ...signals, recentSessions: recent, foodLast7 })}\n\nQuestion: ${question}` }],
  });
  return text ?? "Coach couldn't answer just now. Try again in a minute.";
}
