"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";
import { DRINKS, drinkName, isDrinkKind } from "@/lib/drinks";
import { getContext } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { FOOD_DAYS_BACK } from "@/lib/energy";
import { callClaude } from "@/lib/coach";
import { portionText, scale, type Label } from "@/lib/portion";

type Source = "manual" | "saved" | "barcode" | "photo" | "text";
export type Estimate = { name: string; kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; note?: string | null };

async function ctx() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

async function okDay(day: string) {
  const { today } = await getContext();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today && day >= addDays(today, -FOOD_DAYS_BACK) ? day : today;
}

const clampKcal = (n: number) => Math.max(0, Math.min(5000, Math.round(n)));
const clampP = (n: number) => Math.max(0, Math.min(500, Math.round(n * 10) / 10));
/** Carbs/fat: empty or unusable means "not known", kept apart from 0. */
const optG = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? null : clampP(n));
const okG = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 && n <= 5000 ? Math.round(n * 10) / 10 : null);
const badMacro = (label: string, n: number | null | undefined) =>
  n != null && (!Number.isFinite(n) || n < 0 || n > 500) ? `${label} should be between 0 and 500 g.` : null;

export type LogInput = {
  day: string; name: string; kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null;
  /** What was eaten, e.g. "33 g" or "⅓ pack". */
  portion: string | null; source: Source;
  /** Save the label (not just this portion) for next time, with the amount eaten. */
  save?: { label: Label; amount: number } | null;
};

export async function logFood(input: LogInput): Promise<{ error: string | null }> {
  const { supabase } = await ctx();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give it a name." };
  if (!Number.isFinite(input.kcal) || input.kcal < 0 || input.kcal > 5000) return { error: "Calories should be between 0 and 5,000." };
  if (!Number.isFinite(input.protein_g) || input.protein_g < 0 || input.protein_g > 500) return { error: "Protein should be between 0 and 500 g." };
  const bad = badMacro("Carbs", input.carbs_g) ?? badMacro("Fat", input.fat_g);
  if (bad) return { error: bad };
  const day = await okDay(input.day);
  let savedId: string | null = null;
  if (input.save) {
    const l = input.save.label;
    if (!Number.isFinite(l.kcal) || l.kcal < 0 || l.kcal > 5000) return { error: "The label's calories should be between 0 and 5,000." };
    const lbad = badMacro("The label's protein", l.protein_g) ?? badMacro("The label's carbs", l.carbs_g) ?? badMacro("The label's fat", l.fat_g);
    if (lbad) return { error: lbad };
    const { data, error } = await supabase.from("saved_foods")
      .insert({
        name, kcal: clampKcal(l.kcal), protein_g: clampP(l.protein_g), carbs_g: optG(l.carbs_g), fat_g: optG(l.fat_g),
        base_g: okG(l.baseG), pack_g: okG(l.packG), last_amount: okAmount(input.save.amount),
        use_count: 1, last_used: new Date().toISOString(),
      })
      .select("id").single();
    if (error) return { error: error.message };
    savedId = data.id;
  }
  const { error } = await supabase.from("food_logs").insert({
    day, name, kcal: clampKcal(input.kcal), protein_g: clampP(input.protein_g), carbs_g: optG(input.carbs_g), fat_g: optG(input.fat_g),
    portion: input.portion?.slice(0, 24) || null, source: input.source, saved_food_id: savedId,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}

/** Logs drinks as one food entry tagged as a drink, so they count toward calories and Coach can see them. */
export async function logDrink(kind: string, count: number, dayIn: string): Promise<{ error: string | null }> {
  const { supabase } = await ctx();
  if (!isDrinkKind(kind)) return { error: "Pick what you had." };
  const n = Math.round(count);
  if (!Number.isFinite(n) || n < 1 || n > 20) return { error: "Between 1 and 20 drinks." };
  const day = await okDay(dayIn);
  const d = DRINKS[kind];
  const { error } = await supabase.from("food_logs").insert({
    day, name: drinkName(kind, n), kcal: d.kcal * n, protein_g: 0, carbs_g: Math.min(500, d.carbs * n), fat_g: 0,
    portion: `${n} × ${d.label.toLowerCase()}`.slice(0, 24), source: "drink", drinks: n,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}

const okAmount = (n: number) => (Number.isFinite(n) && n > 0 && n <= 5000 ? Math.round(n * 100) / 100 : null);

/** Logs a saved food. `amount` is grams for foods saved per 100 g, otherwise packs/servings; empty = last time's amount. */
export async function logSaved(id: string, day: string, amount?: number | null): Promise<{ error: string | null }> {
  const { supabase } = await ctx();
  const { data: f } = await supabase.from("saved_foods").select("id, name, kcal, protein_g, carbs_g, fat_g, base_g, pack_g, last_amount, use_count").eq("id", id).single();
  if (!f) return { error: "That saved food is gone." };
  const label: Label = { kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: f.carbs_g == null ? null : Number(f.carbs_g), fat_g: f.fat_g == null ? null : Number(f.fat_g), baseG: f.base_g == null ? null : Number(f.base_g), packG: f.pack_g == null ? null : Number(f.pack_g) };
  const amt = okAmount(Number(amount)) ?? okAmount(Number(f.last_amount)) ?? (label.baseG ?? 1);
  const m = scale(label, amt);
  if (m.kcal > 5000 || m.protein_g > 500 || (m.carbs_g ?? 0) > 500 || (m.fat_g ?? 0) > 500) return { error: "That's more than one entry can hold. Use a smaller amount." };
  const { error } = await supabase.from("food_logs").insert({
    day: await okDay(day), name: f.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
    portion: portionText(label, amt), source: "saved", saved_food_id: f.id,
  });
  if (error) return { error: error.message };
  await supabase.from("saved_foods").update({ use_count: (f.use_count ?? 0) + 1, last_used: new Date().toISOString(), last_amount: amt }).eq("id", f.id);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function deleteSaved(id: string) {
  const { supabase } = await ctx();
  await supabase.from("saved_foods").delete().eq("id", id);
  revalidatePath("/food", "layout");
}

export async function deleteFood(fd: FormData) {
  const { supabase } = await ctx();
  const id = String(fd.get("id") ?? "");
  if (id) await supabase.from("food_logs").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function applySuggestedTarget(fd: FormData) {
  const { supabase, user } = await ctx();
  const kcal = Number(fd.get("kcal"));
  const tdee = Number(fd.get("tdee"));
  if (kcal >= 1200 && kcal <= 5000) {
    await supabase.from("profiles").update({ target_kcal: Math.round(kcal), ...(tdee > 1200 && tdee < 6000 ? { tdee_kcal: Math.round(tdee) } : {}) }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
}

const ESTIMATE_PROMPT =
  "Estimate the calories, protein, carbohydrates and fat of this food as eaten, for the whole portion shown or described. " +
  "Use typical Spanish and US portion sizes when unclear, and round to sensible numbers. " +
  'Reply with ONLY JSON: {"name": short name (max 5 words), "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "note": one short sentence on the main assumption, or null}.';

function parseEstimate(text: string | null): Estimate | null {
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const kcal = Number(j.kcal), protein_g = Number(j.protein_g);
    if (!Number.isFinite(kcal) || !Number.isFinite(protein_g)) return null;
    return { name: String(j.name ?? "Meal").slice(0, 60), kcal: clampKcal(kcal), protein_g: clampP(protein_g), carbs_g: optG(j.carbs_g == null ? null : Number(j.carbs_g)), fat_g: optG(j.fat_g == null ? null : Number(j.fat_g)), note: typeof j.note === "string" ? j.note.slice(0, 160) : null };
  } catch { return null; }
}

/** AI estimate from a photo (data URL, already shrunk on the phone) and/or a short description. */
export async function estimateFood(input: { photo?: string | null; text?: string | null }): Promise<Estimate | { error: string }> {
  await ctx();
  const text = (input.text ?? "").trim().slice(0, 300);
  const content: unknown[] = [];
  if (input.photo) {
    const m = input.photo.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!m || m[2].length > 1_400_000) return { error: "That photo couldn't be read. Try again or describe it." };
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!content.length && !text) return { error: "Take a photo or describe what you ate." };
  content.push({ type: "text", text: `${ESTIMATE_PROMPT}${text ? `\n\nWhat I ate: ${text}` : ""}` });
  let est: Estimate | null = null;
  try { est = parseEstimate(await callClaude({ max_tokens: 300, messages: [{ role: "user", content }] })); } catch {}
  return est ?? { error: "Couldn't estimate that right now. Enter the numbers yourself below." };
}

export type FoodEdit = { id: string; name: string; kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; day: string; remove?: boolean };

/** Saves every change made in Food's edit mode at once: renames, new numbers, moves to another day, removals. */
export async function updateFoods(edits: FoodEdit[]): Promise<{ error: string | null }> {
  const { supabase } = await ctx();
  const { today } = await getContext();
  for (const e of edits.slice(0, 200)) {
    if (e.remove) { await supabase.from("food_logs").delete().eq("id", e.id); continue; }
    const name = e.name.trim().slice(0, 80);
    if (!name) return { error: "Every entry needs a name." };
    if (!Number.isFinite(e.kcal) || e.kcal < 0 || e.kcal > 5000) return { error: `${name}: calories should be between 0 and 5,000.` };
    if (!Number.isFinite(e.protein_g) || e.protein_g < 0 || e.protein_g > 500) return { error: `${name}: protein should be between 0 and 500 g.` };
    const bad = badMacro(`${name}: carbs`, e.carbs_g) ?? badMacro(`${name}: fat`, e.fat_g);
    if (bad) return { error: bad };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.day) || e.day > today || e.day < addDays(today, -FOOD_DAYS_BACK)) return { error: `${name}: pick a day in the last ${FOOD_DAYS_BACK} days.` };
    const { error } = await supabase.from("food_logs").update({ name, kcal: clampKcal(e.kcal), protein_g: clampP(e.protein_g), carbs_g: optG(e.carbs_g), fat_g: optG(e.fat_g), day: e.day }).eq("id", e.id);
    if (error) return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { error: null };
}
