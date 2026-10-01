"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { getTz } from "@/lib/tz";
import { writeCoachRead } from "@/lib/coach";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const WARMUPS = ["stairs", "elliptical", "treadmill", "rower"];

export async function startSession(formData: FormData) {
  const { supabase } = await ctx();
  const today = todayIn(await getTz());
  const dayId = String(formData.get("day_id") ?? "");
  const warmup = String(formData.get("warmup") ?? "");
  const finisher = String(formData.get("finisher") ?? "");
  const cooldown = formData.get("cooldown") === "on";

  const { data: day } = await supabase
    .from("program_days")
    .select("id, program, name, program_exercises(exercise_id, position, target_sets, rep_range)")
    .eq("id", dayId)
    .single();
  if (!day) throw new Error("That workout day no longer exists.");

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      kind: day.program === "kettlebell" ? "kettlebell" : "split",
      day_id: day.id,
      title: day.name,
      session_date: today,
      warmup: WARMUPS.includes(warmup) ? warmup : null,
      finisher: finisher || null,
      cooldown,
    })
    .select("id")
    .single();
  if (error || !session) throw new Error(error?.message ?? "Could not start the session.");

  const pes = ((day.program_exercises ?? []) as any[]).sort((a, b) => a.position - b.position);
  if (pes.length) {
    const { data: ses, error: e2 } = await supabase
      .from("session_exercises")
      .insert(pes.map((pe, i) => ({ session_id: session.id, exercise_id: pe.exercise_id, position: i + 1, target_sets: pe.target_sets, rep_range: pe.rep_range })))
      .select("id, target_sets");
    if (e2) throw new Error(e2.message);
    const sets = (ses ?? []).flatMap((se: any) => Array.from({ length: se.target_sets }, (_, k) => ({ session_exercise_id: se.id, set_no: k + 1 })));
    if (sets.length) {
      const { error: e3 } = await supabase.from("session_sets").insert(sets);
      if (e3) throw new Error(e3.message);
    }
  }
  redirect(`/train/session/${session.id}`);
}

export async function startCustom() {
  const { supabase } = await ctx();
  const today = todayIn(await getTz());
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ kind: "custom", title: "Custom workout", session_date: today })
    .select("id")
    .single();
  if (error || !session) throw new Error(error?.message ?? "Could not start the session.");
  redirect(`/train/session/${session.id}`);
}

export async function saveSet(setId: string, weightKg: number | null, reps: number | null, done: boolean) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("session_sets")
    .update({ weight_kg: weightKg, reps, done, done_at: done ? new Date().toISOString() : null })
    .eq("id", setId);
  if (error) throw new Error(error.message);
}

export async function addSet(sessionExerciseId: string) {
  const { supabase } = await ctx();
  const { data: last } = await supabase
    .from("session_sets").select("set_no").eq("session_exercise_id", sessionExerciseId).order("set_no", { ascending: false }).limit(1);
  const next = (last?.[0]?.set_no ?? 0) + 1;
  const { data, error } = await supabase
    .from("session_sets").insert({ session_exercise_id: sessionExerciseId, set_no: next }).select("id, set_no").single();
  if (error) throw new Error(error.message);
  return data as { id: string; set_no: number };
}

export async function setExtra(sessionId: string, field: "warmup_done" | "finisher_done" | "cooldown_done", value: boolean) {
  const { supabase } = await ctx();
  await supabase.from("sessions").update({ [field]: value }).eq("id", sessionId);
  revalidatePath(`/train/session/${sessionId}`);
}

async function findOrCreateExercise(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const { data: found } = await supabase.from("exercises").select("id, name").ilike("name", clean).limit(5);
  const exact = (found ?? []).find((e: any) => e.name.toLowerCase() === clean.toLowerCase());
  if (exact) return exact.id as string;
  const { data, error } = await supabase.from("exercises").insert({ name: clean, created_by: userId }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not add that exercise.");
  return data.id as string;
}

export async function addExercise(sessionId: string, formData: FormData) {
  const { supabase, user } = await ctx();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const sets = Math.min(10, Math.max(1, Number(formData.get("sets")) || 3));
  const reps = String(formData.get("reps") ?? "").trim();
  const weightKg = Number(formData.get("weight_kg")) || null;
  const exerciseId = await findOrCreateExercise(supabase, user.id, name);
  const { data: last } = await supabase.from("session_exercises").select("position").eq("session_id", sessionId).order("position", { ascending: false }).limit(1);
  const { data: se, error } = await supabase
    .from("session_exercises")
    .insert({ session_id: sessionId, exercise_id: exerciseId, position: (last?.[0]?.position ?? 0) + 1, target_sets: sets, rep_range: reps || null })
    .select("id")
    .single();
  if (error || !se) throw new Error(error?.message ?? "Could not add that exercise.");
  await supabase.from("session_sets").insert(
    Array.from({ length: sets }, (_, k) => ({ session_exercise_id: se.id, set_no: k + 1, weight_kg: weightKg, reps: reps && /^\d+$/.test(reps) ? Number(reps) : null })),
  );
  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath(`/train/session/${sessionId}/edit`);
}

export async function removeExercise(sessionId: string, sessionExerciseId: string) {
  const { supabase } = await ctx();
  const { data: done } = await supabase.from("session_sets").select("id").eq("session_exercise_id", sessionExerciseId).eq("done", true).limit(1);
  if (done?.length) return; // logged lifts are locked
  await supabase.from("session_exercises").delete().eq("id", sessionExerciseId);
  revalidatePath(`/train/session/${sessionId}/edit`);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function moveExercise(sessionId: string, sessionExerciseId: string, dir: -1 | 1) {
  const { supabase } = await ctx();
  const { data } = await supabase.from("session_exercises").select("id, position").eq("session_id", sessionId).order("position");
  const list = (data ?? []) as { id: string; position: number }[];
  const i = list.findIndex((r) => r.id === sessionExerciseId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((r, k) => supabase.from("session_exercises").update({ position: k + 1 }).eq("id", r.id)));
  revalidatePath(`/train/session/${sessionId}/edit`);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function finishSession(sessionId: string) {
  const { supabase } = await ctx();
  // Unticked sets stay in the session but never count as logged (only done sets feed history).
  await supabase.from("sessions").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", sessionId);
  try {
    await writeCoachRead(supabase, { kind: "session", sourceId: sessionId });
  } catch (e) {
    console.error("Coach read failed", e);
  }
  revalidatePath("/", "layout");
  redirect("/train?finished=1");
}

export async function discardSession(sessionId: string) {
  const { supabase } = await ctx();
  await supabase.from("sessions").delete().eq("id", sessionId).eq("status", "in_progress");
  revalidatePath("/", "layout");
  redirect("/train");
}
