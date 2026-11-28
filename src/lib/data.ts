import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Units } from "@/lib/units";
import { mondayOf, todayIn } from "@/lib/dates";
import { getTz } from "@/lib/tz";
import { groupExercises, type ExerciseRow } from "@/lib/exercise-match";
import { fetchAll } from "@/lib/fetch-all";
import type { HistoryRow } from "@/lib/rows";
import { getActiveBreak, nextHolidayDay, weekStart, type Break } from "@/lib/breaks";

export type Supa = Awaited<ReturnType<typeof createClient>>;

export type Profile = {
  id: string; display_name: string | null; household_id: string | null; units: Units;
  height_cm: number | null; sex: string | null; birth_year: number | null;
  phase: string; target_rate_kg_week: number | null; goal_weight_kg: number | null; goal_body_fat_pct?: number | null; tdee_kcal: number | null; target_kcal: number | null;
  protein_g: number | null; carbs_g: number | null; fat_g: number | null; kettlebells_kg: number[];
  notify_weigh_in: boolean; weigh_in_time: string; notify_workout: boolean; workout_time: string;
  notify_sleep: boolean; sleep_time: string;
};

/**
 * Per-request context. getClaims() verifies the session JWT locally (no round trip to
 * Supabase Auth when the project uses asymmetric signing keys); cache() dedupes it within
 * one render.
 */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };
  const [{ data: profile }, tz] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getTz(),
  ]);
  const today = todayIn(tz);
  return {
    supabase, user, tz, today,
    profile: (profile ?? { id: user.id, units: "metric" }) as Profile,
    units: ((profile?.units as Units) ?? "metric") as Units,
  };
});

export type PlanLift = {
  exercise_id: string; name: string; position: number; target_sets: number; rep_range: string;
  sub_for?: { id: string; name: string } | null; added?: boolean;
};
export type ProgramDay = {
  id: string; program: "split" | "kettlebell" | "holiday"; name: string; day_order: number;
  /** What the next session builds from: the user's plan override when one exists, else the template. */
  exercises: PlanLift[];
  template: PlanLift[];
  overridden: boolean;
};

/** The program, with each day's lifts replaced by the user's plan override (swaps and additions) when there is one. */
export async function getProgram(supabase: Supa): Promise<ProgramDay[]> {
  const [{ data }, { data: ov }] = await Promise.all([
    supabase
      .from("program_days")
      .select("id, program, name, day_order, program_exercises(exercise_id, position, target_sets, rep_range, exercises(name))")
      .order("program")
      .order("day_order"),
    supabase
      .from("plan_overrides")
      .select("day_id, position, exercise_id, target_sets, rep_range, sub_for, added, exercises!plan_overrides_exercise_id_fkey(name), sub:exercises!plan_overrides_sub_for_fkey(id, name)")
      .order("position"),
  ]);
  const overrides = new Map<string, PlanLift[]>();
  for (const r of (ov ?? []) as unknown as { day_id: string; exercise_id: string; position: number; target_sets: number; rep_range: string | null; added: boolean; exercises: { name: string } | null; sub: { id: string; name: string } | null }[]) {
    if (!overrides.has(r.day_id)) overrides.set(r.day_id, []);
    overrides.get(r.day_id)!.push({
      exercise_id: r.exercise_id, name: r.exercises?.name ?? "", position: r.position, target_sets: r.target_sets,
      rep_range: r.rep_range ?? "", sub_for: r.sub ? { id: r.sub.id, name: r.sub.name } : null, added: r.added,
    });
  }
  return ((data ?? []) as unknown as { id: string; program: ProgramDay["program"]; name: string; day_order: number; program_exercises: { exercise_id: string; position: number; target_sets: number; rep_range: string; exercises: { name: string } | null }[] | null }[])
    .map((d) => {
      const template: PlanLift[] = (d.program_exercises ?? [])
        .map((pe) => ({ exercise_id: pe.exercise_id, name: pe.exercises?.name ?? "", position: pe.position, target_sets: pe.target_sets, rep_range: pe.rep_range }))
        .sort((a: PlanLift, b: PlanLift) => a.position - b.position);
      const over = overrides.get(d.id);
      return { id: d.id, program: d.program, name: d.name, day_order: d.day_order, template, exercises: over?.length ? over : template, overridden: !!over?.length };
    })
    .sort((a, b) => (a.program === b.program ? a.day_order - b.day_order : a.program === "split" ? -1 : 1));
}

export type FinisherMove = { name: string; dose: string; done?: boolean };
export type Finisher = { id: string; name: string; moves: FinisherMove[]; is_default: boolean };

export async function getFinishers(supabase: Supa): Promise<Finisher[]> {
  const { data } = await supabase.from("finishers").select("id, name, moves, is_default").order("position");
  return ((data ?? []) as { id: string; name: string; moves: FinisherMove[] | null; is_default: boolean }[]).map((f) => ({ id: f.id, name: f.name, moves: f.moves ?? [], is_default: f.is_default }));
}

export type LastTime = { date: string; top: number | null; sets: { weight_kg: number | null; reps: number | null }[] };

/**
 * Most recent finished-session performance for each exercise. Names that mean the same lift
 * ("KB Swings" / "Kettlebell Swing") are one exercise here: each requested id gets the latest
 * session across all of them.
 */
export async function getLastTimes(supabase: Supa, exerciseIds: string[], excludeSessionId?: string) {
  const out = new Map<string, LastTime>();
  if (!exerciseIds.length) return out;
  const { data: exRows } = await supabase.from("exercises").select("id, name, created_by, created_at");
  const { keyById, byKey } = groupExercises((exRows ?? []) as ExerciseRow[]);
  const keyOf = (id: string) => keyById.get(id) ?? id;
  const wanted = new Set<string>();
  for (const id of exerciseIds) for (const sib of byKey.get(keyOf(id))?.ids ?? [id]) wanted.add(sib);
  const data = await fetchAll((a, b) => supabase
    .from("session_exercises")
    .select("id, exercise_id, session_id, sessions!inner(session_date, status, started_at), session_sets(set_no, weight_kg, reps, done)")
    .in("exercise_id", [...wanted])
    .eq("sessions.status", "done")
    .order("id")
    .range(a, b)
    .overrideTypes<HistoryRow[], { merge: false }>());
  const rows = data
    .filter((r) => r.session_id !== excludeSessionId)
    .sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? 1 : -1));
  const byGroup = new Map<string, LastTime>();
  for (const r of rows) {
    const k = keyOf(r.exercise_id);
    if (byGroup.has(k)) continue;
    const sets = (r.session_sets ?? []).filter((s) => s.done).sort((a, b) => a.set_no - b.set_no);
    if (!sets.length) continue;
    // 0 kg means no added weight: it never counts as a top set.
    const weights = sets.map((s) => Number(s.weight_kg)).filter((x) => x > 0);
    byGroup.set(k, {
      date: r.sessions.session_date,
      top: weights.length ? Math.max(...weights) : null,
      sets: sets.map((s) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps })),
    });
  }
  for (const id of exerciseIds) {
    const l = byGroup.get(keyOf(id));
    if (l) out.set(id, l);
  }
  return out;
}

export type Candidate = { name: string; last: LastTime | null };

/** Every lift you can add: one entry per exercise (synonyms merged), with your latest history of it. */
export async function getCandidates(supabase: Supa, excludeSessionId?: string): Promise<Candidate[]> {
  const { data } = await supabase.from("exercises").select("id, name, created_by, created_at");
  const { groups } = groupExercises((data ?? []) as ExerciseRow[]);
  const last = await getLastTimes(supabase, groups.map((g) => g.rep.id), excludeSessionId);
  return groups.map((g) => ({ name: g.rep.name, last: last.get(g.rep.id) ?? null }));
}

export type WeekState = {
  monday: string;
  done: Map<string, string>; // split day id -> session date
  nextDay: ProgramDay | null;
  inProgress: { id: string; title: string } | null;
  /** Every session finished today, any kind (split, kettlebell, custom). */
  doneToday: { id: string; title: string; kind: string }[];
  /** Every workout finished since Monday, any kind. */
  doneThisWeek: number;
  /** Holiday mode: the break you're on today, and workouts done toward its weekly target. */
  brk: Break | null;
  breakDone: number;
};

/** Which split days are done this week, and which one is up next. */
type WeekRow = { id: string; title: string; day_id: string | null; session_date: string; status: string; kind: string };

export async function getWeekState(supabase: Supa, today: string, program: ProgramDay[] | Promise<ProgramDay[]>): Promise<WeekState> {
  const monday = mondayOf(today);
  const [{ data }, { data: open }, prog, brk] = await Promise.all([
    supabase.from("sessions").select("id, title, day_id, session_date, status, kind").gte("session_date", monday).eq("status", "done"),
    supabase.from("sessions").select("id, title").eq("status", "in_progress").order("started_at", { ascending: false }).limit(1),
    Promise.resolve(program),
    getActiveBreak(supabase, today),
  ]);
  const done = new Map<string, string>();
  for (const s of ((data ?? []) as WeekRow[]).sort((a, b) => (a.session_date < b.session_date ? 1 : -1))) {
    if (s.kind === "split" && s.day_id && !done.has(s.day_id)) done.set(s.day_id, s.session_date);
  }
  const inProgress = open?.length ? { id: open[0].id as string, title: open[0].title as string } : null;
  const doneToday = ((data ?? []) as WeekRow[])
    .filter((s) => s.session_date === today)
    .map((s) => ({ id: s.id as string, title: s.title as string, kind: s.kind as string }));
  const split = prog.filter((d) => d.program === "split");
  let nextDay = split.find((d) => !done.has(d.id)) ?? split[0] ?? null;
  let breakDone = 0;
  if (brk) {
    // On a break: alternate the holiday workouts, and count every workout this week (Sunday-first) since the break began.
    const from = weekStart(today) > brk.start_date ? weekStart(today) : brk.start_date;
    const holidayIds = prog.filter((d) => d.program === "holiday").map((d) => d.id);
    const [{ data: lastH }, { count }] = await Promise.all([
      holidayIds.length
        ? supabase.from("sessions").select("day_id").eq("status", "done").in("day_id", holidayIds).order("started_at", { ascending: false }).limit(1)
        : Promise.resolve({ data: [] as { day_id: string }[] }),
      supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "done").gte("session_date", from).lte("session_date", today),
    ]);
    nextDay = nextHolidayDay(prog, ((lastH ?? [])[0] as { day_id: string } | undefined)?.day_id ?? null) ?? nextDay;
    breakDone = count ?? 0;
  }
  return { monday, done, nextDay, inProgress, doneToday, doneThisWeek: (data ?? []).length, brk, breakDone };
}

export function displayName(p: Profile, email?: string | null) {
  return p.display_name || (email ? email.split("@")[0] : "You");
}
