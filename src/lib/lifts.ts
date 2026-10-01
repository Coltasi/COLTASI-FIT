import type { Supa } from "@/lib/data";

export type ExHistory = { exercise_id: string; name: string; sessions: { date: string; top: number | null; sets: { weight_kg: number | null; reps: number | null }[] }[] };

/** Every finished-session performance, grouped by exercise, oldest first. */
export async function getLiftHistory(supabase: Supa, exerciseId?: string): Promise<ExHistory[]> {
  let q = supabase
    .from("session_exercises")
    .select("exercise_id, exercises(name), sessions!inner(session_date, status, started_at), session_sets(set_no, weight_kg, reps, done)")
    .eq("sessions.status", "done");
  if (exerciseId) q = q.eq("exercise_id", exerciseId);
  const { data } = await q;
  const map = new Map<string, ExHistory>();
  for (const r of ((data ?? []) as any[]).sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? -1 : 1))) {
    const sets = (r.session_sets ?? []).filter((s: any) => s.done).sort((a: any, b: any) => a.set_no - b.set_no)
      .map((s: any) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps }));
    if (!sets.length) continue;
    const ws = sets.map((s: any) => s.weight_kg).filter((x: any) => x != null) as number[];
    if (!map.has(r.exercise_id)) map.set(r.exercise_id, { exercise_id: r.exercise_id, name: r.exercises?.name ?? "", sessions: [] });
    map.get(r.exercise_id)!.sessions.push({ date: r.sessions.session_date, top: ws.length ? Math.max(...ws) : null, sets });
  }
  return [...map.values()];
}
