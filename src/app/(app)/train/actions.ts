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
    .select("exercise_id, order_index, target_sets, target_rep_range")
    .eq("program_day_id", dayId)
    .order("order_index");

  // session_exercises is the session's own, editable exercise list — seeded here
  // from the program day's template, but mutable afterwards (add/remove/reorder)
  // independent of that template.
  const sessionExercisesToInsert = (programExercises ?? []).map((pe) => ({
    session_id: session.id,
    exercise_id: pe.exercise_id,
    order_index: pe.order_index ?? 0,
    target_sets: pe.target_sets,
    target_rep_range: pe.target_rep_range,
  }));

  if (sessionExercisesToInsert.length > 0) {
    await supabase.from("session_exercises").insert(sessionExercisesToInsert);
  }

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

export async function startCustomSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      session_date: todayIso(),
      session_type: "custom",
      split_day: null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error(error?.message ?? "Could not start custom workout");
  }

  redirect(`/train/session/${session.id}/edit?new=1`);
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

// --- Editing a session's exercise list (add / remove / reorder) ---
// Used by both "Edit Workout" on a normal session and by fully custom
// (build-it-as-you-go) workouts, which start with an empty exercise list.

export async function addExerciseToSession(
  sessionId: string,
  exerciseId: string,
  targetSets: number,
  targetRepRange: string,
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("session_exercises")
    .select("order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

  const { error } = await supabase.from("session_exercises").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: nextOrder,
    target_sets: targetSets,
    target_rep_range: targetRepRange || null,
  });
  if (error) throw new Error(error.message);

  const setRows = Array.from({ length: targetSets }, (_, i) => ({
    session_id: sessionId,
    exercise_id: exerciseId,
    set_number: i + 1,
  }));
  await supabase.from("workout_sets").insert(setRows);

  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath(`/train/session/${sessionId}/edit`);
}

export async function removeExerciseFromSession(
  sessionId: string,
  exerciseId: string,
) {
  const supabase = await createClient();
  await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);
  await supabase
    .from("session_exercises")
    .delete()
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);

  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath(`/train/session/${sessionId}/edit`);
}

export async function moveSessionExercise(
  sessionId: string,
  exerciseId: string,
  direction: "up" | "down",
) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("session_exercises")
    .select("id, exercise_id, order_index")
    .eq("session_id", sessionId)
    .order("order_index");

  if (!rows) return;
  const idx = rows.findIndex((r) => r.exercise_id === exerciseId);
  if (idx === -1) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rows.length) return;

  const a = rows[idx];
  const b = rows[swapWith];

  await Promise.all([
    supabase
      .from("session_exercises")
      .update({ order_index: b.order_index })
      .eq("id", a.id),
    supabase
      .from("session_exercises")
      .update({ order_index: a.order_index })
      .eq("id", b.id),
  ]);

  revalidatePath(`/train/session/${sessionId}/edit`);
}
