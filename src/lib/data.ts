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
};

export async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const tz = await getTz();
  const today = todayIn(tz);
  return {
    supabase, user, tz, today,
    profile: (profile ?? { id: user.id, units: "metric" }) as Profile,
    units: ((profile?.units as Units) ?? "metric") as Units,
  };
}

export type ProgramDay = {
  id: string; program: "split" | "kettlebell"; name: string; day_order: number;
  exercises: { exercise_id: string; name: string; position: number; target_sets: number; rep_range: string }[];
};

export async function getProgram(supabase: Supa): Promise<ProgramDay[]> {
  const { data } = await supabase
    .from("program_days")
    .select("id, program, name, day_order, program_exercises(exercise_id, position, target_sets, rep_range, exercises(name))")
    .order("program")
    .order("day_order");
  return ((data ?? []) as any[])
    .map((d) => ({
      id: d.id, program: d.program, name: d.name, day_order: d.day_order,
      exercises: (d.program_exercises ?? [])
        .map((pe: any) => ({ exercise_id: pe.exercise_id, name: pe.exercises?.name ?? "", position: pe.position, target_sets: pe.target_sets, rep_range: pe.rep_range }))
        .sort((a: any, b: any) => a.position - b.position),
    }))
    .sort((a, b) => (a.program === b.program ? a.day_order - b.day_order : a.program === "split" ? -1 : 1));
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
    const weights = sets.map((s: any) => s.weight_kg).filter((x: any) => x != null).map(Number);
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
export async function getWeekState(supabase: Supa, today: string, program: ProgramDay[]): Promise<WeekState> {
  const monday = mondayOf(today);
  const split = program.filter((d) => d.program === "split");
  const { data } = await supabase
    .from("sessions")
    .select("id, title, day_id, session_date, status, kind")
    .gte("session_date", monday)
    .order("started_at", { ascending: false });
  const done = new Map<string, string>();
  let inProgress: WeekState["inProgress"] = null;
  for (const s of (data ?? []) as any[]) {
    if (s.status === "done" && s.kind === "split" && s.day_id && !done.has(s.day_id)) done.set(s.day_id, s.session_date);
    if (s.status === "in_progress" && !inProgress) inProgress = { id: s.id, title: s.title };
  }
  if (!inProgress) {
    const { data: open } = await supabase.from("sessions").select("id, title").eq("status", "in_progress").order("started_at", { ascending: false }).limit(1);
    if (open?.length) inProgress = { id: open[0].id, title: open[0].title };
  }
  const nextDay = split.find((d) => !done.has(d.id)) ?? split[0] ?? null;
  return { monday, done, nextDay, inProgress };
}

export function displayName(p: Profile, email?: string | null) {
  return p.display_name || (email ? email.split("@")[0] : "You");
}
