"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function startSession(
  dayId: string,
  dayName: string,
  warmupChoice: string | null,
  abFinisher: boolean,
  cooldown: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isKettlebell = dayName.startsWith("Full Body");
  const sessionType = isKettlebell ? "kettlebell" : "split";

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      session_date: todayIso(),
      session_type: sessionType,
      split_day: dayName,
      started_at: new Date().toISOString(),
      warmup_choice: warmupChoice,
      ab_finisher: abFinisher,
      cooldown: cooldown,
    })
    .select()
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Could not start session");
  }

  const { data: programExercises } = await supabase
    .from("program_exercises")
    .select("exercise_id, target_sets")
    .eq("program_day_id", dayId);

  const setsToInsert = (programExercises ?? []).flatMap((pe) =>
    Array.from({ length: pe.target_sets }, (_, i) => ({
      session_id: session.id,
      exercise_id: pe.exercise_id,
      set_number: i + 1,
    })),
  );

  if (setsToInsert.length > 0) {
    await supabase.from("workout_sets").insert(setsToInsert);
  }

  redirect(`/train/session/${session.id}`);
}

export async function logExercise(
  sessionId: string,
  exerciseId: string,
  weightKg: number,
  reps: number,
) {
  const supabase = await createClient();
  await supabase
    .from("workout_sets")
    .update({ weight_kg: weightKg, reps, completed: true })
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function reopenExercise(sessionId: string, exerciseId: string) {
  const supabase = await createClient();
  await supabase
    .from("workout_sets")
    .update({ completed: false })
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function setSessionFlag(
  sessionId: string,
  field: "warmup_done" | "ab_finisher_done" | "cooldown_done",
  value: boolean,
) {
  const supabase = await createClient();
  await supabase
    .from("workout_sessions")
    .update({ [field]: value })
    .eq("id", sessionId);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function finishSession(sessionId: string) {
  const supabase = await createClient();
  await supabase
    .from("workout_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  redirect("/");
}
