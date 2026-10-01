import { notFound } from "next/navigation";
import { getContext, getLastTimes } from "@/lib/data";
import { SessionView, type SEx } from "./session-view";

export default async function SessionPage({ params }: PageProps<"/train/session/[id]">) {
  const { id } = await params;
  const { supabase, units } = await getContext();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, kind, title, status, warmup, warmup_done, finisher, finisher_done, cooldown, cooldown_done, session_exercises(id, exercise_id, position, target_sets, rep_range, exercises(name), session_sets(id, set_no, weight_kg, reps, done))")
    .eq("id", id)
    .single();
  if (!s) notFound();

  const ses = ((s.session_exercises ?? []) as any[]).sort((a, b) => a.position - b.position);
  const last = await getLastTimes(supabase, ses.map((x) => x.exercise_id), s.id);
  const exercises: SEx[] = ses.map((x) => ({
    id: x.id,
    name: x.exercises?.name ?? "",
    plan: `${x.target_sets} × ${x.rep_range ?? "?"}`,
    last: last.get(x.exercise_id) ?? null,
    sets: ((x.session_sets ?? []) as any[])
      .sort((a, b) => a.set_no - b.set_no)
      .map((z) => ({ id: z.id, set_no: z.set_no, weight_kg: z.weight_kg == null ? null : Number(z.weight_kg), reps: z.reps, done: z.done })),
  }));

  return (
    <SessionView
      key={exercises.map((e) => `${e.id}:${e.sets.length}`).join(",")}
      session={{
        id: s.id, kind: s.kind, title: s.title, status: s.status,
        warmup: s.warmup, warmup_done: s.warmup_done, finisher: s.finisher, finisher_done: s.finisher_done,
        cooldown: s.cooldown, cooldown_done: s.cooldown_done,
      }}
      exercises={exercises}
      units={units}
    />
  );
}
