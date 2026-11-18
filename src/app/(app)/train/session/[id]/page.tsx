import { notFound } from "next/navigation";
import { getCandidates, getContext, getLastTimes } from "@/lib/data";
import { SessionView, type SEx } from "./session-view";
import { LoggedView } from "./logged-view";

export default async function SessionPage({ params, searchParams }: PageProps<"/train/session/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, units } = await getContext();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, kind, title, status, session_date, warmup, warmup_done, finisher, finisher_moves, finisher_done, cooldown, cooldown_done, session_exercises(id, exercise_id, position, target_sets, rep_range, sub_for, added, exercises(name), session_sets(id, set_no, weight_kg, reps, done))")
    .eq("id", id)
    .single();
  if (!s) notFound();

  const ses = ((s.session_exercises ?? []) as any[]).sort((a, b) => a.position - b.position);

  if (s.status !== "in_progress") {
    return (
      <LoggedView
        title={s.title}
        date={s.session_date}
        status={s.status}
        units={units}
        lifts={ses.map((x) => ({
          id: x.id,
          name: x.exercises?.name ?? "",
          sets: ((x.session_sets ?? []) as any[]).filter((z) => z.done).sort((a, b) => a.set_no - b.set_no)
            .map((z) => ({ weight_kg: z.weight_kg == null ? null : Number(z.weight_kg), reps: z.reps })),
        }))}
      />
    );
  }

  const { data: allEx } = await supabase.from("exercises").select("id, name, created_by").order("name");
  const exRows = ((allEx ?? []) as any[]);
  const nameById = new Map(exRows.map((e) => [e.id as string, e.name as string]));
  const last = await getLastTimes(supabase, [...new Set(ses.map((x) => x.exercise_id))], s.id);

  const exercises: SEx[] = ses.map((x) => ({
    id: x.id,
    exerciseId: x.exercise_id,
    name: x.exercises?.name ?? "",
    plan: `${x.target_sets} × ${x.rep_range ?? "?"}`,
    subFor: x.sub_for ? nameById.get(x.sub_for) ?? null : null,
    last: last.get(x.exercise_id) ?? null,
    sets: ((x.session_sets ?? []) as any[])
      .sort((a, b) => a.set_no - b.set_no)
      .map((z) => ({ id: z.id, set_no: z.set_no, weight_kg: z.weight_kg == null ? null : Number(z.weight_kg), reps: z.reps, done: z.done })),
  }));

  // Lifts offered in the swap/add sheet: one per exercise (synonyms merged), with your latest history of it.
  const candidates = await getCandidates(supabase, s.id);

  return (
    <SessionView
      key={exercises.map((e) => `${e.id}:${e.sets.length}`).join(",")}
      session={{
        id: s.id, kind: s.kind, title: s.title,
        warmup: s.warmup, warmup_done: s.warmup_done, cooldown: s.cooldown, cooldown_done: s.cooldown_done,
        finisher: !!s.finisher, finisher_done: s.finisher_done,
      }}
      initialOpen={typeof sp.open === "string" ? sp.open : null}
      exercises={exercises}
      candidates={candidates}
      units={units}
    />
  );
}
