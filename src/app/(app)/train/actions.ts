"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { getTz } from "@/lib/tz";
import { writeCoachRead } from "@/lib/coach";
import { currentUser } from "@/lib/supabase/user";
import { getLastTimes } from "@/lib/data";

async function ctx() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

const WARMUPS = ["stairs", "elliptical", "treadmill", "rower"];
type Supa = Awaited<ReturnType<typeof createClient>>;
type NewLift = { exercise_id: string; target_sets: number; rep_range: string | null; sub_for?: string | null; added?: boolean };

/** Inserts lifts (and their empty sets) into a session, numbered from `fromPos`. Returns the new session_exercise ids. */
async function insertLifts(supabase: Supa, sessionId: string, lifts: NewLift[], fromPos: number): Promise<string[]> {
  if (!lifts.length) return [];
  const { data: ses, error } = await supabase
    .from("session_exercises")
    .insert(lifts.map((l, i) => ({
      session_id: sessionId, exercise_id: l.exercise_id, position: fromPos + i, target_sets: l.target_sets,
      rep_range: l.rep_range, sub_for: l.sub_for ?? null, added: !!l.added,
    })))
    .select("id, target_sets, position");
  if (error) throw new Error(error.message);
  const rows = ((ses ?? []) as any[]).sort((a, b) => a.position - b.position);
  const sets = rows.flatMap((se) => Array.from({ length: se.target_sets }, (_, k) => ({ session_exercise_id: se.id, set_no: k + 1 })));
  if (sets.length) {
    const { error: e2 } = await supabase.from("session_sets").insert(sets);
    if (e2) throw new Error(e2.message);
  }
  return rows.map((r) => r.id as string);
}

function parseMoves(raw: FormDataEntryValue | null): { name: string; dose: string; done: boolean }[] | null {
  try {
    const j = JSON.parse(String(raw ?? ""));
    if (!Array.isArray(j)) return null;
    return j
      .map((m: any) => ({ name: String(m?.name ?? "").trim().slice(0, 80), dose: String(m?.dose ?? "").trim().slice(0, 40), done: false }))
      .filter((m) => m.name);
  } catch {
    return null;
  }
}

/**
 * Starts a program day. Builds from the user's plan override for that day when there is one.
 * With quick=1 (the Start button on Overview) it uses the defaults: Stairs warm-up, the default
 * finisher and a cool-down.
 */
export async function startSession(formData: FormData) {
  const { supabase } = await ctx();
  const today = todayIn(await getTz());
  const dayId = String(formData.get("day_id") ?? "");
  const quick = formData.get("quick") === "1";

  const { data: open } = await supabase.from("sessions").select("id").eq("status", "in_progress").limit(1);
  if (open?.length) redirect(`/train/session/${open[0].id}`);

  const [{ data: day }, { data: over }, { data: fins }] = await Promise.all([
    supabase.from("program_days").select("id, program, name, program_exercises(exercise_id, position, target_sets, rep_range)").eq("id", dayId).single(),
    supabase.from("plan_overrides").select("exercise_id, position, target_sets, rep_range, sub_for, added").eq("day_id", dayId).order("position"),
    supabase.from("finishers").select("id, name, moves, is_default").order("position"),
  ]);
  if (!day) throw new Error("That workout day no longer exists.");

  let warmup = String(formData.get("warmup") ?? "");
  let cooldown = formData.get("cooldown") === "on";
  let finisher: string | null = null;
  let moves: { name: string; dose: string; done: boolean }[] | null = null;
  if (quick) {
    warmup = "stairs";
    cooldown = true;
    const f = ((fins ?? []) as any[]).find((x) => x.is_default) ?? (fins ?? [])[0];
    if (f) { finisher = f.name; moves = ((f.moves ?? []) as any[]).map((m) => ({ name: m.name, dose: m.dose, done: false })); }
  } else {
    finisher = String(formData.get("finisher") ?? "").trim() || null;
    moves = finisher ? parseMoves(formData.get("finisher_moves")) : null;
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      kind: day.program === "kettlebell" ? "kettlebell" : "split",
      day_id: day.id,
      title: day.name,
      session_date: today,
      warmup: WARMUPS.includes(warmup) ? warmup : null,
      finisher,
      finisher_moves: moves,
      cooldown,
    })
    .select("id")
    .single();
  if (error || !session) throw new Error(error?.message ?? "Could not start the session.");

  const plan: NewLift[] = over?.length
    ? (over as any[]).map((o) => ({ exercise_id: o.exercise_id, target_sets: o.target_sets, rep_range: o.rep_range, sub_for: o.sub_for, added: o.added }))
    : ((day.program_exercises ?? []) as any[]).sort((a, b) => a.position - b.position)
        .map((pe) => ({ exercise_id: pe.exercise_id, target_sets: pe.target_sets, rep_range: pe.rep_range }));
  await insertLifts(supabase, session.id, plan, 1);
  revalidatePath("/", "layout");
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

async function findOrCreateExercise(supabase: Supa, userId: string, name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const { data: found } = await supabase.from("exercises").select("id, name, created_by").ilike("name", clean).limit(5);
  // With both a personal and a program lift of the same name, use the personal one: that's where your history is.
  const exact = ((found ?? []) as any[])
    .sort((a, b) => (a.created_by == null ? 1 : 0) - (b.created_by == null ? 1 : 0))
    .find((e) => e.name.toLowerCase() === clean.toLowerCase());
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
  const [{ data: last }, { data: sess }] = await Promise.all([
    supabase.from("session_exercises").select("position").eq("session_id", sessionId).order("position", { ascending: false }).limit(1),
    supabase.from("sessions").select("kind").eq("id", sessionId).single(),
  ]);
  const { data: se, error } = await supabase
    .from("session_exercises")
    .insert({ session_id: sessionId, exercise_id: exerciseId, position: (last?.[0]?.position ?? 0) + 1, target_sets: sets, rep_range: reps || null, added: sess?.kind === "split" })
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
  const { supabase, user } = await ctx();
  // Unticked sets stay in the session but never count as logged (only done sets feed history).
  const { data: s } = await supabase
    .from("sessions")
    .update({ status: "done", finished_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("kind, day_id, session_exercises(exercise_id, position, target_sets, rep_range, sub_for, added, session_sets(id))")
    .single();
  // Carry-over: a Split day's final lift list becomes that day's plan for next time.
  if (s?.kind === "split" && s.day_id) {
    try {
      await savePlanOverride(supabase, user.id, s.day_id, ((s.session_exercises ?? []) as any[])
        .sort((a, b) => a.position - b.position)
        .map((x) => ({ exercise_id: x.exercise_id, target_sets: Math.min(10, Math.max(1, (x.session_sets ?? []).length || x.target_sets)), rep_range: x.rep_range, sub_for: x.sub_for, added: x.added })));
    } catch (e) {
      console.error("Saving plan override failed", e);
    }
  }
  // Write the Coach read after the response so finishing feels instant.
  after(async () => {
    try {
      await writeCoachRead(supabase, { kind: "session", sourceId: sessionId });
    } catch (e) {
      console.error("Coach read failed", e);
    }
  });
  revalidatePath("/", "layout");
  redirect("/train?finished=1");
}

/**
 * Stores `lifts` as the plan override for a day. When the list matches the template
 * (same lifts, order and set counts, no swaps), the override is cleared instead.
 */
async function savePlanOverride(supabase: Supa, userId: string, dayId: string, lifts: NewLift[]) {
  const { data: tpl } = await supabase.from("program_exercises").select("exercise_id, target_sets").eq("day_id", dayId).order("position");
  const t = (tpl ?? []) as { exercise_id: string; target_sets: number }[];
  const same = lifts.length === t.length && lifts.every((l, i) => l.exercise_id === t[i].exercise_id && l.target_sets === t[i].target_sets && !l.sub_for && !l.added);
  const { error: delErr } = await supabase.from("plan_overrides").delete().eq("day_id", dayId).eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  if (same || !lifts.length) return;
  const { error } = await supabase.from("plan_overrides").insert(lifts.map((l, i) => ({
    day_id: dayId, position: i + 1, exercise_id: l.exercise_id, target_sets: l.target_sets, rep_range: l.rep_range,
    sub_for: l.sub_for ?? null, added: !!l.added,
  })));
  if (error) throw new Error(error.message);
}

/** Undo on Train: a swap goes back to the template lift (at the first replacement's position); an added lift is removed. */
export async function undoPlanChange(dayId: string, position: number) {
  const { supabase, user } = await ctx();
  const [{ data: ov }, { data: tpl }] = await Promise.all([
    supabase.from("plan_overrides").select("exercise_id, position, target_sets, rep_range, sub_for, added").eq("day_id", dayId).order("position"),
    supabase.from("program_exercises").select("exercise_id, target_sets, rep_range").eq("day_id", dayId),
  ]);
  let list: NewLift[] = ((ov ?? []) as any[]).map((o) => ({ exercise_id: o.exercise_id, target_sets: o.target_sets, rep_range: o.rep_range, sub_for: o.sub_for, added: o.added }));
  const i = ((ov ?? []) as any[]).findIndex((o) => o.position === position);
  if (i < 0) return;
  const row = list[i];
  if (row.sub_for) {
    const orig = ((tpl ?? []) as any[]).find((p) => p.exercise_id === row.sub_for);
    const first = list.findIndex((l) => l.sub_for === row.sub_for);
    list = list.filter((l) => l.sub_for !== row.sub_for);
    if (orig) list.splice(first, 0, { exercise_id: orig.exercise_id, target_sets: orig.target_sets, rep_range: orig.rep_range });
  } else {
    list.splice(i, 1);
  }
  await savePlanOverride(supabase, user.id, dayId, list);
  revalidatePath("/", "layout");
}

/** Defaults for a lift picked from the swap/add sheet: set count and rep range from its last session. */
async function liftsFromNames(supabase: Supa, userId: string, names: string[]) {
  const ids = [];
  for (const n of names.map((x) => x.trim()).filter(Boolean).slice(0, 8)) ids.push(await findOrCreateExercise(supabase, userId, n));
  const last = await getLastTimes(supabase, ids);
  return ids.map((id) => {
    const reps = (last.get(id)?.sets ?? []).map((z) => z.reps).filter((r): r is number => r != null);
    const lo = reps.length ? Math.min(...reps) : null, hi = reps.length ? Math.max(...reps) : null;
    return {
      exercise_id: id,
      target_sets: Math.min(10, Math.max(3, reps.length)),
      rep_range: lo == null ? "8–12" : lo === hi ? String(lo) : `${lo}–${hi}`,
    };
  });
}

/** Renumbers a session's lifts so `order` (session_exercise ids) is positions 1..n. */
async function renumber(supabase: Supa, order: string[]) {
  await Promise.all(order.map((id, k) => supabase.from("session_exercises").update({ position: k + 1 }).eq("id", id)));
}

/** Replaces a lift with one or more others at the same position. Returns the first new lift's id. */
export async function swapLift(sessionId: string, sessionExerciseId: string, names: string[]): Promise<string | null> {
  const { supabase, user } = await ctx();
  const { data: rows } = await supabase
    .from("session_exercises").select("id, exercise_id, position, sub_for, session_sets(done)").eq("session_id", sessionId).order("position");
  const list = (rows ?? []) as any[];
  const i = list.findIndex((r) => r.id === sessionExerciseId);
  if (i < 0) return null;
  const orig = list[i];
  if ((orig.session_sets ?? []).some((z: any) => z.done)) return null; // logged lifts are locked
  const picks = await liftsFromNames(supabase, user.id, names);
  if (!picks.length) return null;
  const from = orig.sub_for ?? orig.exercise_id;
  const ids = await insertLifts(supabase, sessionId, picks.map((p) => ({ ...p, sub_for: from })), 1000);
  await supabase.from("session_exercises").delete().eq("id", orig.id);
  await renumber(supabase, [...list.slice(0, i).map((r) => r.id), ...ids, ...list.slice(i + 1).map((r) => r.id)]);
  revalidatePath(`/train/session/${sessionId}`);
  return ids[0] ?? null;
}

/** Adds lifts at the end. On Split days they're marked as added, so they carry over. Returns the first new id. */
export async function addLifts(sessionId: string, names: string[]): Promise<string | null> {
  const { supabase, user } = await ctx();
  const [{ data: last }, { data: sess }] = await Promise.all([
    supabase.from("session_exercises").select("position").eq("session_id", sessionId).order("position", { ascending: false }).limit(1),
    supabase.from("sessions").select("kind").eq("id", sessionId).single(),
  ]);
  const picks = await liftsFromNames(supabase, user.id, names);
  const ids = await insertLifts(supabase, sessionId, picks.map((p) => ({ ...p, added: sess?.kind === "split" })), (last?.[0]?.position ?? 0) + 1);
  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath(`/train/session/${sessionId}/edit`);
  return ids[0] ?? null;
}

/** Saves the session's ab finisher (name + moves with ticks). null removes it ("Skip today"). */
export async function setSessionFinisher(sessionId: string, finisher: { name: string; moves: { name: string; dose: string; done?: boolean }[] } | null) {
  const { supabase } = await ctx();
  const moves = finisher?.moves.map((m) => ({ name: String(m.name).slice(0, 80), dose: String(m.dose).slice(0, 40), done: !!m.done })) ?? null;
  await supabase.from("sessions").update({
    finisher: finisher ? finisher.name.slice(0, 80) : null,
    finisher_moves: moves,
    finisher_done: !!moves?.length && moves.every((m) => m.done),
  }).eq("id", sessionId);
}

/** Saves edits to a finisher from the Train sheet and makes it the default. */
export async function saveFinisher(id: string, moves: { name: string; dose: string }[]) {
  const { supabase } = await ctx();
  const clean = moves.map((m) => ({ name: String(m.name).trim().slice(0, 80), dose: String(m.dose).trim().slice(0, 40) })).filter((m) => m.name);
  await supabase.from("finishers").update({ is_default: false }).neq("id", id);
  await supabase.from("finishers").update({ moves: clean, is_default: true }).eq("id", id);
  revalidatePath("/train");
}

export async function discardSession(sessionId: string) {
  const { supabase } = await ctx();
  await supabase.from("sessions").delete().eq("id", sessionId).eq("status", "in_progress");
  revalidatePath("/", "layout");
  redirect("/train");
}
