import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Units } from "@/lib/units";
import { mondayOf, todayIn } from "@/lib/dates";
import { getTz } from "@/lib/tz";

export type Supa = Awaited<ReturnType<typeof createClient>>;

export type Profile = {
  id: string; display_name: string | null; household_id: string | null; units: Units;
  height_cm: number | null; sex: string | null; birth_year: number | null;
  phase: string; target_rate_kg_week: number | null; tdee_kcal: number | null; target_kcal: number | null;
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
  id: string; program: "split" | "kettlebell"; name: string; day_order: number;
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
  for (const r of (ov ?? []) as any[]) {
    if (!overrides.has(r.day_id)) overrides.set(r.day_id, []);
    overrides.get(r.day_id)!.push({
      exercise_id: r.exercise_id, name: r.exercises?.name ?? "", position: r.position, target_sets: r.target_sets,
      rep_range: r.rep_range ?? "", sub_for: r.sub ? { id: r.sub.id, name: r.sub.name } : null, added: r.added,
    });
  }
  return ((data ?? []) as any[])
    .map((d) => {
      const template: PlanLift[] = (d.program_exercises ?? [])
        .map((pe: any) => ({ exercise_id: pe.exercise_id, name: pe.exercises?.name ?? "", position: pe.position, target_sets: pe.target_sets, rep_range: pe.rep_range }))
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
  return ((data ?? []) as any[]).map((f) => ({ id: f.id, name: f.name, moves: (f.moves ?? []) as FinisherMove[], is_default: f.is_default }));
}

export type LastTime = { date: string; top: number | null; sets: { weight_kg: number | null; reps: number | null }[] };

/** Most recent finished-session performance for each exercise. */
export async function getLastTimes(supabase: Supa, exerciseIds: string[], excludeSessionId?: string) {
  const out = new Map<string, LastTime>();
  if (!exerciseIds.length) return out;
  const { data } = await supabase
    .from("session_exercises")
    .select("exercise_id, session_id, sessions!inner(session_date, status, started_at), session_sets(set_no, weight_kg, reps, done)")
    .in("exercise_id", exerciseIds)
    .eq("sessions.status", "done");
  const rows = ((data ?? []) as any[])
    .filter((r) => r.session_id !== excludeSessionId)
    .sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? 1 : -1));
  for (const r of rows) {
    if (out.has(r.exercise_id)) continue;
    const sets = (r.session_sets ?? []).filter((s: any) => s.done).sort((a: any, b: any) => a.set_no - b.set_no);
    if (!sets.length) continue;
    // 0 kg means no added weight: it never counts as a top set.
    const weights = sets.map((s: any) => Number(s.weight_kg)).filter((x: number) => x > 0);
    out.set(r.exercise_id, {
      date: r.sessions.session_date,
      top: weights.length ? Math.max(...weights) : null,
      sets: sets.map((s: any) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps })),
    });
  }
  return out;
}

export type WeekState = {
  monday: string;
  done: Map<string, string>; // split day id -> session date
  nextDay: ProgramDay | null;
  inProgress: { id: string; title: string } | null;
};

/** Which split days are done this week, and which one is up next. */
export async function getWeekState(supabase: Supa, today: string, program: ProgramDay[] | Promise<ProgramDay[]>): Promise<WeekState> {
  const monday = mondayOf(today);
  const [{ data }, { data: open }, prog] = await Promise.all([
    supabase.from("sessions").select("id, title, day_id, session_date, status, kind").gte("session_date", monday).eq("status", "done"),
    supabase.from("sessions").select("id, title").eq("status", "in_progress").order("started_at", { ascending: false }).limit(1),
    Promise.resolve(program),
  ]);
  const done = new Map<string, string>();
  for (const s of ((data ?? []) as any[]).sort((a, b) => (a.session_date < b.session_date ? 1 : -1))) {
    if (s.kind === "split" && s.day_id && !done.has(s.day_id)) done.set(s.day_id, s.session_date);
  }
  const inProgress = open?.length ? { id: open[0].id as string, title: open[0].title as string } : null;
  const split = prog.filter((d) => d.program === "split");
  const nextDay = split.find((d) => !done.has(d.id)) ?? split[0] ?? null;
  return { monday, done, nextDay, inProgress };
}

export function displayName(p: Profile, email?: string | null) {
  return p.display_name || (email ? email.split("@")[0] : "You");
}
