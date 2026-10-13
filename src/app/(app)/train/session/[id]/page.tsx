import { notFound } from "next/navigation";
import { getContext, getFinishers, getLastTimes, type FinisherMove } from "@/lib/data";
import { SessionView, type Candidate, type SEx } from "./session-view";
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

  const [{ data: allEx }, finishers] = await Promise.all([
    supabase.from("exercises").select("id, name, created_by").order("name"),
    getFinishers(supabase),
  ]);
  const exRows = ((allEx ?? []) as any[]);
  const nameById = new Map(exRows.map((e) => [e.id as string, e.name as string]));
  const last = await getLastTimes(supabase, [...new Set([...ses.map((x) => x.exercise_id), ...exRows.map((e) => e.id)])], s.id);

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

  // Lifts offered in the swap/add sheet: the program's lifts plus your own, one per name,
  // with the most recent history of any lift by that name.
  const byName = new Map<string, Candidate>();
  for (const e of exRows) {
    const k = e.name.toLowerCase();
    const l = last.get(e.id) ?? null;
    const prev = byName.get(k);
    if (!prev) byName.set(k, { name: e.name, last: l });
    else if (l && (!prev.last || l.date > prev.last.date)) prev.last = l;
  }
  const candidates = [...byName.values()];

  // Sessions started before v4 have a finisher name but no moves: fill them from the matching finisher.
  let finMoves = s.finisher_moves as FinisherMove[] | null;
  if (s.finisher && !finMoves) {
    const f = finishers.find((x) => x.name === s.finisher);
    finMoves = (f?.moves ?? [{ name: s.finisher, dose: "" }]).map((m) => ({ ...m, done: s.finisher_done }));
  }

  return (
    <SessionView
      key={exercises.map((e) => `${e.id}:${e.sets.length}`).join(",")}
      session={{
        id: s.id, kind: s.kind, title: s.title,
        warmup: s.warmup, warmup_done: s.warmup_done, cooldown: s.cooldown, cooldown_done: s.cooldown_done,
        finisher: s.finisher ? { name: s.finisher, moves: finMoves ?? [] } : null,
      }}
      initialOpen={typeof sp.open === "string" ? sp.open : null}
      exercises={exercises}
      finishers={finishers.map((f) => ({ name: f.name, moves: f.moves }))}
      candidates={candidates}
      units={units}
    />
  );
}
