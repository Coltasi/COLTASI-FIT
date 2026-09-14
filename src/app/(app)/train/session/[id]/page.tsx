import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExerciseRow } from "./exercise-row";
import { FlagRow } from "./flag-row";
import { FinishButton } from "./finish-button";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default async function TrainSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (!session) notFound();

  // The session's exercise list lives in session_exercises, not the program
  // template — it's seeded from the program day at start, but editable from
  // there on (add/remove/reorder), and is the only source for a fully custom
  // (no split_day) workout.
  const { data: sessionExercises } = await supabase
    .from("session_exercises")
    .select("order_index, target_sets, target_rep_range, exercises(id, name)")
    .eq("session_id", id)
    .order("order_index");

  const exerciseIds = (sessionExercises ?? [])
    .map((se) => (se.exercises as unknown as { id: string; name: string } | null)?.id)
    .filter((eid): eid is string => !!eid);

  const [{ data: sets }, { data: history }] = await Promise.all([
    supabase.from("workout_sets").select("*").eq("session_id", id),
    exerciseIds.length
      ? supabase
          .from("workout_sets")
          .select("exercise_id, weight_kg, reps, workout_sessions(session_date)")
          .neq("session_id", id)
          .in("exercise_id", exerciseIds)
          .eq("completed", true)
          .not("weight_kg", "is", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const setsByExercise = new Map<string, { weight_kg: number | null; reps: number | null; completed: boolean }[]>();
  for (const s of sets ?? []) {
    const arr = setsByExercise.get(s.exercise_id) ?? [];
    arr.push(s);
    setsByExercise.set(s.exercise_id, arr);
  }

  const lastByExercise = new Map<string, { weight: number; reps: number; date: string }>();
  for (const h of history ?? []) {
    const s = h.workout_sessions as unknown as { session_date: string } | null;
    if (!lastByExercise.has(h.exercise_id) && s) {
      lastByExercise.set(h.exercise_id, {
        weight: h.weight_kg!,
        reps: h.reps!,
        date: s.session_date,
      });
    }
  }

  const isDone = !!session.completed_at;
  const isKettlebell = (session.split_day ?? "").startsWith("Full Body");
  const isCustom = session.session_type === "custom";
  const heading = session.split_day ?? "Custom Workout";
  const eyebrow = isCustom ? "No plan — built as you go" : isKettlebell ? "Kettlebell" : "The Split";

  return (
    <div className="px-5 pt-[30px] pb-8">
      <div className="flex items-center justify-between">
        <p className="text-muted text-[15px]">{eyebrow}</p>
        {!isDone && (
          <Link
            href={`/train/session/${session.id}/edit`}
            className="text-blue flex items-center gap-1.5 text-[14px] font-semibold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            Edit
          </Link>
        )}
      </div>
      <h1 className="font-display mt-1 mb-4.5 text-[26px] font-extrabold tracking-tight">
        {heading} · <i>{isDone ? "done" : "in progress"}</i>
      </h1>

      <div className="flex flex-col gap-3">
        {session.warmup_choice && (
          <FlagRow
            sessionId={session.id}
            field="warmup_done"
            label={`Warm-up · ${session.warmup_choice}`}
            sub="10 min"
            initialDone={!!session.warmup_done}
          />
        )}

        {(sessionExercises ?? []).map((se) => {
          const ex = se.exercises as unknown as { id: string; name: string } | null;
          if (!ex) return null;
          const exSets = setsByExercise.get(ex.id) ?? [];
          const completed = exSets.length > 0 && exSets.every((s) => s.completed);
          const last = lastByExercise.get(ex.id);
          const targetLabel = se.target_rep_range
            ? `${se.target_sets} × ${se.target_rep_range}`
            : `${se.target_sets} sets`;
          const lastLabel = last
            ? `last time ${last.weight} kg (${formatShortDate(last.date)})`
            : null;
          const loggedLabel =
            completed && exSets[0]?.weight_kg != null
              ? `${targetLabel} · ${exSets[0].weight_kg} kg × ${exSets[0].reps}`
              : null;

          return (
            <ExerciseRow
              key={ex.id}
              sessionId={session.id}
              exerciseId={ex.id}
              name={ex.name}
              targetLabel={targetLabel}
              completed={completed}
              loggedLabel={loggedLabel}
              lastLabel={lastLabel}
              defaultWeight={exSets[0]?.weight_kg ?? last?.weight ?? null}
              defaultReps={exSets[0]?.reps ?? last?.reps ?? null}
            />
          );
        })}

        {(sessionExercises ?? []).length === 0 && !isDone && (
          <Link
            href={`/train/session/${session.id}/edit`}
            className="border-muted-2 rounded-[14px] border border-dashed bg-surface px-4 py-6 text-center"
          >
            <p className="text-[15px] font-semibold">Nothing in this workout yet</p>
            <p className="text-muted mt-0.5 text-[13px]">Tap here to add your first exercise</p>
          </Link>
        )}

        {session.ab_finisher && (
          <FlagRow
            sessionId={session.id}
            field="ab_finisher_done"
            label="Ab Finisher"
            sub="not started"
            initialDone={!!session.ab_finisher_done}
          />
        )}

        {session.cooldown && (
          <FlagRow
            sessionId={session.id}
            field="cooldown_done"
            label="Cool Down · Stretch & breathing"
            sub="5 min · not started"
            initialDone={!!session.cooldown_done}
          />
        )}
      </div>

      <p className="text-muted mt-3.5 text-center text-[13px]">
        Checkmarks here are just for marking sets done — tap a row to log
        weight and reps.
      </p>

      {!isDone && (
        <div className="mt-5">
          <FinishButton sessionId={session.id} />
        </div>
      )}

      {isDone && (
        <p className="text-muted mt-5 text-center text-[13px]">
          <Link href="/" className="text-blue font-semibold">
            Back to Overview →
          </Link>
        </p>
      )}
    </div>
  );
}
