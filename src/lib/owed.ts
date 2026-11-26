import type { Supa } from "@/lib/data";
import { addDays, fmtShort } from "@/lib/dates";
import { GUIDES } from "@/lib/exercise-guides";
import { groupExercises, type ExerciseRow } from "@/lib/exercise-match";

export type SkipReason = "sore" | "equipment" | "time";
export const SKIP_LABEL: Record<SkipReason, string> = { sore: "sore", equipment: "no equipment", time: "short on time" };

/** A lift you skipped that the Coach will remind you to come back to. */
export type Owed = {
  /** session_exercises id of the skipped row. */
  id: string;
  name: string;
  reason: SkipReason;
  date: string;
  /** Workout it was skipped in, e.g. "Pull". */
  from: string;
  /** How many times this lift was skipped in the last 30 days (3+ means it may need swapping). */
  skips30: number;
};

const OWED_DAYS = 7;

/**
 * Skipped lifts still owed: skipped in the last 7 days, not dropped, not done since, and the
 * same workout day hasn't come round again (then it's just part of that day as usual).
 */
type SkipRow = {
  id: string; exercise_id: string; skipped_reason: SkipReason; owed_cleared: boolean; skill: boolean; exercises: { name: string } | null;
  sessions: { id: string; day_id: string | null; title: string; session_date: string; status: string; started_at: string };
};

export async function getOwed(supabase: Supa, today: string): Promise<Owed[]> {
  const since30 = addDays(today, -30);
  const [{ data: skipped }, { data: exRows }] = await Promise.all([
    supabase
      .from("session_exercises")
      .select("id, exercise_id, skipped_reason, owed_cleared, skill, exercises(name), sessions!inner(id, day_id, title, session_date, status, started_at)")
      .not("skipped_reason", "is", null)
      .eq("sessions.status", "done")
      .gte("sessions.session_date", since30),
    supabase.from("exercises").select("id, name, created_by, created_at"),
  ]);
  const rows = ((skipped ?? []) as unknown as SkipRow[]).filter((r) => !r.skill);
  if (!rows.length) return [];
  const { keyById, byKey } = groupExercises((exRows ?? []) as ExerciseRow[]);
  const keyOf = (id: string) => keyById.get(id) ?? id;

  const skips30 = new Map<string, number>();
  for (const r of rows) skips30.set(keyOf(r.exercise_id), (skips30.get(keyOf(r.exercise_id)) ?? 0) + 1);

  const cutoff = addDays(today, -OWED_DAYS);
  const live = rows.filter((r) => !r.owed_cleared && r.sessions.session_date >= cutoff);
  if (!live.length) return [];

  // Anything done since: the lift itself (any spelling), or a later session of the same day.
  const ids = [...new Set(live.flatMap((r) => byKey.get(keyOf(r.exercise_id))?.ids ?? [r.exercise_id]))];
  const minStart = live.map((r) => r.sessions.started_at as string).sort()[0];
  const [{ data: doneSince }, { data: laterDays }] = await Promise.all([
    supabase
      .from("session_exercises")
      .select("exercise_id, sessions!inner(started_at, status), session_sets!inner(done)")
      .in("exercise_id", ids)
      .eq("sessions.status", "done")
      .eq("session_sets.done", true)
      .gt("sessions.started_at", minStart),
    supabase.from("sessions").select("day_id, started_at").eq("status", "done").gt("started_at", minStart).not("day_id", "is", null),
  ]);

  const out: Owed[] = [];
  const seen = new Set<string>();
  for (const r of live.sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? 1 : -1))) {
    const k = keyOf(r.exercise_id);
    if (seen.has(k)) continue;
    const at = r.sessions.started_at as string;
    const redone = ((doneSince ?? []) as unknown as { exercise_id: string; sessions: { started_at: string } }[]).some((d) => keyOf(d.exercise_id) === k && d.sessions.started_at > at);
    const dayAgain = r.sessions.day_id && ((laterDays ?? []) as { day_id: string; started_at: string }[]).some((d) => d.day_id === r.sessions.day_id && d.started_at > at);
    if (redone || dayAgain) continue;
    seen.add(k);
    out.push({
      id: r.id, name: r.exercises?.name ?? "", reason: r.skipped_reason, date: r.sessions.session_date,
      from: r.sessions.title, skips30: skips30.get(k) ?? 1,
    });
  }
  return out;
}

const muscles = (name: string) => (GUIDES[name]?.primary ?? []).map((m) => m.toLowerCase());

/**
 * Owed lifts that suit a workout. Skipped for time or kit: any workout. Skipped because sore:
 * never the same workout, and never one that hits the same main muscles while they recover.
 */
export function owedFor(owed: Owed[], workoutTitle: string, liftNames: string[]): Owed[] {
  const hit = new Set(liftNames.flatMap(muscles));
  return owed.filter((o) => {
    if (liftNames.some((n) => n.toLowerCase() === o.name.toLowerCase())) return false;
    if (o.reason !== "sore") return true;
    if (o.from === workoutTitle) return false;
    return !muscles(o.name).some((m) => hit.has(m));
  });
}

export function owedLine(o: Owed) {
  return `Skipped ${fmtShort(o.date)} in ${o.from} · ${SKIP_LABEL[o.reason]}`;
}
