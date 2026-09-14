import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExercisePicker } from "./exercise-picker";

export default async function AddExercisePage({
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
    .select("id")
    .eq("id", id)
    .single();
  if (!session) notFound();

  const [{ data: allExercises }, { data: already }] = await Promise.all([
    supabase.from("exercises").select("id, name, modality").order("name"),
    supabase.from("session_exercises").select("exercise_id").eq("session_id", id),
  ]);

  const alreadyIds = new Set((already ?? []).map((a) => a.exercise_id));
  const available = (allExercises ?? []).filter((ex) => !alreadyIds.has(ex.id));

  return (
    <div className="px-5 pt-[30px] pb-8">
      <div className="mb-4.5 flex items-center justify-between">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight">
          Add Exercise
        </h1>
        <Link href={`/train/session/${id}/edit`} className="text-blue text-[15px] font-semibold">
          Done
        </Link>
      </div>

      <ExercisePicker sessionId={id} exercises={available} />
    </div>
  );
}
