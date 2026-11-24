import { notFound } from "next/navigation";
import { getCandidates, getContext, getLastTimes } from "@/lib/data";
import { SessionView, type SEx } from "./session-view";
import { LoggedView } from "./logged-view";
import { sleepSignal, type LiftSignal, type Night } from "@/lib/coach-signals";
import { liftChange } from "@/components/coach-plan";
import { getOwed, owedFor } from "@/lib/owed";
import { gradeSession, liftOutcome, type LiftLike } from "@/lib/effort";

export default async function SessionPage({ params, searchParams }: PageProps<"/train/session/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, units, today } = await getContext();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, kind, title, status, session_date, feel, pain_areas, notes, effort, warmup, warmup_done, finisher, finisher_moves, finisher_done, cooldown, cooldown_done, edit_snapshot, session_exercises(id, exercise_id, position, target_sets, rep_range, sub_for, added, skipped_reason, skill, exercises(name), session_sets(id, set_no, weight_kg, reps, done))")
    .eq("id", id)
    .single();
  if (!s) notFound();

  const ses = ((s.session_exercises ?? []) as any[]).sort((a, b) => a.position - b.position);

  if (s.status !== "in_progress") {
    const { data: rd } = await supabase.from("coach_reads").select("signals").eq("kind", "session").eq("source_id", s.id).order("created_at", { ascending: false }).limit(1);
    const sigLifts = ((rd?.[0]?.signals as any)?.lifts ?? []) as LiftLike[];
    const verdict = gradeSession(sigLifts, ses.filter((x) => x.skipped_reason && !x.skill).length);
    const outcomeByName = new Map((sigLifts as (LiftLike & { name?: string })[]).map((l) => [String(l.name ?? "").toLowerCase(), liftOutcome(l)]));
    return (
      <LoggedView
        id={s.id}
        saved={sp.saved === "1"}
        title={s.title}
        date={s.session_date}
        status={s.status}
        units={units}
        verdict={verdict}
        checkIn={{ feel: s.feel ?? null, pains: s.pain_areas ?? [], notes: s.notes ?? null, effort: s.effort ?? null }}
        lifts={ses.map((x) => ({
          id: x.id,
          name: x.exercises?.name ?? "",
          skipped: x.skipped_reason ?? null,
          skill: !!x.skill,
          outcome: outcomeByName.get((x.exercises?.name ?? "").toLowerCase()) ?? null,
          sets: ((x.session_sets ?? []) as any[]).filter((z) => z.done).sort((a, b) => a.set_no - b.set_no)
            .map((z) => ({ weight_kg: z.weight_kg == null ? null : Number(z.weight_kg), reps: z.reps })),
        }))}
      />
    );
  }

  const { data: allEx } = await supabase.from("exercises").select("id, name, created_by").order("name");
  const exRows = ((allEx ?? []) as any[]);
  const nameById = new Map(exRows.map((e) => [e.id as string, e.name as string]));
  const [last, { data: reads }, { data: nights }, owedAll] = await Promise.all([
    getLastTimes(supabase, [...new Set(ses.map((x) => x.exercise_id))], s.id),
    supabase.from("coach_reads").select("signals").not("signals", "is", null).order("created_at", { ascending: false }).limit(15),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags").order("night_of", { ascending: false }).limit(14),
    getOwed(supabase, today),
  ]);
  const owed = owedFor(owedAll, s.title, ses.map((x) => x.exercises?.name ?? ""));

  // Coach's call for each lift: the newest read that mentions it. Going up waits for a good night.
  const calls = new Map<string, LiftSignal>();
  for (const r of (reads ?? []) as any[]) for (const l of (r.signals?.lifts ?? []) as LiftSignal[]) {
    const k = l.name.toLowerCase();
    if (!calls.has(k)) calls.set(k, l);
  }
  const easeOff = sleepSignal(((nights ?? []) as any[]).map((n) => ({ ...n, hours: Number(n.hours), flags: n.flags ?? [] })) as Night[], today).call === "ease";
  const coachFor = (name: string) => {
    const l = calls.get(name.toLowerCase());
    if (!l || (easeOff && l.call === "up")) return null;
    const c = liftChange(l, units);
    return c ? { tone: c.tone, text: c.short, kg: l.bodyweight ? null : l.nextKg } : null;
  };

  const exercises: SEx[] = ses.map((x) => ({
    id: x.id,
    exerciseId: x.exercise_id,
    name: x.exercises?.name ?? "",
    plan: `${x.target_sets} × ${x.rep_range ?? "?"}`,
    subFor: x.sub_for ? nameById.get(x.sub_for) ?? null : null,
    skipped: x.skipped_reason ?? null,
    skill: !!x.skill,
    last: last.get(x.exercise_id) ?? null,
    coach: coachFor(x.exercises?.name ?? ""),
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
        editing: s.edit_snapshot != null,
      }}
      checkIn={{ feel: s.feel ?? null, pains: s.pain_areas ?? [], notes: s.notes ?? null, effort: s.effort ?? null }}
      initialOpen={typeof sp.open === "string" ? sp.open : null}
      exercises={exercises}
      candidates={candidates}
      owed={owed}
      units={units}
    />
  );
}
