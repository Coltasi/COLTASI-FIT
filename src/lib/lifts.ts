import type { Supa } from "@/lib/data";
import { groupExercises, type ExerciseRow } from "@/lib/exercise-match";

export type ExHistory = { exercise_id: string; name: string; sessions: { date: string; top: number | null; sets: { weight_kg: number | null; reps: number | null }[] }[] };

/** Every finished-session performance, grouped by exercise (spellings of the same lift merged), oldest first. */
export async function getLiftHistory(supabase: Supa, exerciseId?: string): Promise<ExHistory[]> {
  let q = supabase
    .from("session_exercises")
    .select("exercise_id, exercises(name), sessions!inner(session_date, status, started_at), session_sets(set_no, weight_kg, reps, done)")
    .eq("sessions.status", "done");
  const { data: exRows } = await supabase.from("exercises").select("id, name, created_by, created_at");
  const { keyById, byKey } = groupExercises((exRows ?? []) as ExerciseRow[]);
  const keyOf = (id: string) => keyById.get(id) ?? id;
  if (exerciseId) q = q.in("exercise_id", byKey.get(keyOf(exerciseId))?.ids ?? [exerciseId]);
  const { data } = await q;
  const map = new Map<string, ExHistory>();
  for (const r of ((data ?? []) as any[]).sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? -1 : 1))) {
    const sets = (r.session_sets ?? []).filter((s: any) => s.done).sort((a: any, b: any) => a.set_no - b.set_no)
      .map((s: any) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps }));
    if (!sets.length) continue;
    const ws = sets.map((s: any) => Number(s.weight_kg)).filter((x: number) => x > 0); // 0 kg = bodyweight
    const k = keyOf(r.exercise_id);
    const rep = byKey.get(k)?.rep;
    if (!map.has(k)) map.set(k, { exercise_id: exerciseId ?? rep?.id ?? r.exercise_id, name: rep?.name ?? r.exercises?.name ?? "", sessions: [] });
    map.get(k)!.sessions.push({ date: r.sessions.session_date, top: ws.length ? Math.max(...ws) : null, sets });
  }
  return [...map.values()];
}
