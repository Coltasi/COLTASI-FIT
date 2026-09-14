import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StartSessionForm } from "./start-session-form";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default async function TrainPreviewPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: day } = await supabase
    .from("program_days")
    .select("id, name")
    .eq("id", dayId)
    .single();

  if (!day) notFound();

  const { data: programExercises } = await supabase
    .from("program_exercises")
    .select("order_index, target_sets, target_rep_range, exercises(id, name)")
    .eq("program_day_id", dayId)
    .order("order_index");

  const exerciseIds = (programExercises ?? [])
    .map((pe) => (pe.exercises as unknown as { id: string; name: string } | null)?.id)
    .filter((id): id is string => !!id);

  const { data: history } = exerciseIds.length
    ? await supabase
        .from("workout_sets")
        .select("exercise_id, weight_kg, workout_sessions(session_date)")
        .eq("workout_sessions.user_id", user.id)
        .in("exercise_id", exerciseIds)
        .eq("completed", true)
        .not("weight_kg", "is", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastByExercise = new Map<string, { weight: number; date: string }>();
  for (const h of history ?? []) {
    const session = h.workout_sessions as unknown as { session_date: string } | null;
    if (!lastByExercise.has(h.exercise_id) && session) {
      lastByExercise.set(h.exercise_id, {
        weight: h.weight_kg!,
        date: session.session_date,
      });
    }
  }

  return (
    <div className="px-5 pt-[30px] pb-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-[15px]">
            Today · <i>not started</i>
          </p>
          <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-tight">
            {day.name}
          </h1>
          <p className="text-muted text-[13px]">
            {day.name.startsWith("Full Body") ? "Kettlebell" : "The Split"}
          </p>
        </div>
        <Link href="/train" className="text-blue mt-1 text-[13px] font-semibold">
          Change workout →
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {(programExercises ?? []).map((pe) => {
          const ex = pe.exercises as unknown as { id: string; name: string } | null;
          if (!ex) return null;
          const last = lastByExercise.get(ex.id);
          return (
            <div
              key={ex.id}
              className="border-border bg-surface rounded-[14px] border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
            >
              <p className="text-[16px] font-semibold">{ex.name}</p>
              <p className="text-muted text-[13px]">
                {pe.target_sets} sets · {pe.target_rep_range} reps
                {last
                  ? ` · last ${last.weight} kg (${formatShortDate(last.date)})`
                  : ""}
              </p>
            </div>
          );
        })}
      </div>

      <StartSessionForm dayId={day.id} dayName={day.name} />
    </div>
  );
}
