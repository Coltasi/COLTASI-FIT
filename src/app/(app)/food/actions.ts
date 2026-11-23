"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";
import { getContext } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { callClaude } from "@/lib/coach";

type Source = "manual" | "saved" | "barcode" | "photo" | "text";
export type Estimate = { name: string; kcal: number; protein_g: number; note?: string | null };

async function ctx() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

async function okDay(day: string) {
  const { today } = await getContext();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today && day >= addDays(today, -14) ? day : today;
}

const clampKcal = (n: number) => Math.max(0, Math.min(5000, Math.round(n)));
const clampP = (n: number) => Math.max(0, Math.min(500, Math.round(n * 10) / 10));

export async function logFood(input: { day: string; name: string; kcal: number; protein_g: number; source: Source; save?: boolean }): Promise<{ error: string | null }> {
  const { supabase } = await ctx();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give it a name." };
  if (!Number.isFinite(input.kcal) || input.kcal < 0 || input.kcal > 5000) return { error: "Calories should be between 0 and 5,000." };
  if (!Number.isFinite(input.protein_g) || input.protein_g < 0 || input.protein_g > 500) return { error: "Protein should be between 0 and 500 g." };
  const day = await okDay(input.day);
  let savedId: string | null = null;
  if (input.save) {
    const { data, error } = await supabase.from("saved_foods")
      .insert({ name, kcal: clampKcal(input.kcal), protein_g: clampP(input.protein_g), use_count: 1, last_used: new Date().toISOString() })
      .select("id").single();
    if (error) return { error: error.message };
    savedId = data.id;
  }
  const { error } = await supabase.from("food_logs").insert({
    day, name, kcal: clampKcal(input.kcal), protein_g: clampP(input.protein_g), source: input.source, saved_food_id: savedId,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}

export async function logSaved(id: string, day: string): Promise<{ error: string | null }> {
  const { supabase } = await ctx();
  const { data: f } = await supabase.from("saved_foods").select("id, name, kcal, protein_g, use_count").eq("id", id).single();
  if (!f) return { error: "That saved food is gone." };
  const { error } = await supabase.from("food_logs").insert({
    day: await okDay(day), name: f.name, kcal: f.kcal, protein_g: f.protein_g, source: "saved", saved_food_id: f.id,
  });
  if (error) return { error: error.message };
  await supabase.from("saved_foods").update({ use_count: (f.use_count ?? 0) + 1, last_used: new Date().toISOString() }).eq("id", f.id);
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
  "Estimate the calories and protein of this food as eaten, for the whole portion shown or described. " +
  "Use typical Spanish and US portion sizes when unclear, and round to sensible numbers. " +
  'Reply with ONLY JSON: {"name": short name (max 5 words), "kcal": number, "protein_g": number, "note": one short sentence on the main assumption, or null}.';

function parseEstimate(text: string | null): Estimate | null {
  const m = text?.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const kcal = Number(j.kcal), protein_g = Number(j.protein_g);
    if (!Number.isFinite(kcal) || !Number.isFinite(protein_g)) return null;
    return { name: String(j.name ?? "Meal").slice(0, 60), kcal: clampKcal(kcal), protein_g: clampP(protein_g), note: typeof j.note === "string" ? j.note.slice(0, 160) : null };
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

export type Product = { name: string; per100: { kcal: number; protein_g: number }; servingG: number | null };

/** Looks a barcode up in Open Food Facts (free, strong on Spanish supermarket products). */
export async function lookupBarcode(code: string): Promise<Product | { error: string }> {
  await ctx();
  const c = code.replace(/\D/g, "");
  if (c.length < 8 || c.length > 14) return { error: "That barcode doesn't look right." };
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,product_name_es,product_name_en,brands,nutriments,serving_quantity`, {
      headers: { "user-agent": "ColtasiFit/1.0 (www.coltasi.com)" },
      cache: "no-store",
    });
    if (!res.ok) return { error: "Product not found. Enter it yourself below." };
    const j = await res.json();
    const p = j?.product;
    const n = p?.nutriments ?? {};
    const kcal = Number(n["energy-kcal_100g"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : NaN));
    if (!p || !Number.isFinite(kcal)) return { error: "Product found but it has no calories listed. Enter it yourself below." };
    const name = [p.product_name_en || p.product_name_es || p.product_name, p.brands?.split(",")[0]].filter(Boolean).join(" · ").slice(0, 70) || "Product";
    const sq = Number(p.serving_quantity);
    return { name, per100: { kcal: Math.round(kcal), protein_g: Math.round(Number(n.proteins_100g ?? 0) * 10) / 10 }, servingG: Number.isFinite(sq) && sq > 0 ? sq : null };
  } catch {
    return { error: "Couldn't reach the food database. Enter it yourself below." };
  }
}
