"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { getTz } from "@/lib/tz";
import { callClaude, writeCoachRead } from "@/lib/coach";
import { currentUser } from "@/lib/supabase/user";

export type FormState = { error: string | null; ok?: boolean };

async function ctx() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function logWeighIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const kg = Number(fd.get("weight_kg"));
  if (!kg || kg < 20 || kg > 400) return { error: "Enter your weight." };
  const day = String(fd.get("measured_on") || todayIn(await getTz()));
  const { data, error } = await supabase
    .from("weigh_ins")
    .upsert({ measured_on: day, weight_kg: Math.round(kg * 100) / 100 }, { onConflict: "user_id,measured_on" })
    .select("id")
    .single();
  if (error) return { error: error.message };
  after(async () => {
    try {
      await writeCoachRead(supabase, { kind: "weigh_in", sourceId: data?.id });
    } catch (e) {
      console.error("Coach read failed", e);
    }
  });
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  return s ? Number(s) : null;
};

export async function saveScan(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const row = {
    scanned_on: String(fd.get("scanned_on") || todayIn(await getTz())),
    weight_kg: num(fd.get("weight_kg")),
    body_fat_pct: num(fd.get("body_fat_pct")),
    fat_mass_kg: num(fd.get("fat_mass_kg")),
    muscle_mass_kg: num(fd.get("muscle_mass_kg")),
    water_pct: num(fd.get("water_pct")),
    visceral_fat: num(fd.get("visceral_fat")),
    bmr_kcal: num(fd.get("bmr_kcal")),
    photo_paths: fd.getAll("photo_path").map(String).filter(Boolean),
  };
  if (row.weight_kg == null && row.body_fat_pct == null && row.muscle_mass_kg == null) return { error: "Fill in at least weight, body fat or muscle mass." };
  const { error } = await supabase.from("scans").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/progress");
  redirect("/progress");
}

const SCAN_KEYS = ["weight_kg", "body_fat_pct", "fat_mass_kg", "muscle_mass_kg", "water_pct", "visceral_fat", "bmr_kcal"] as const;
export type ScanValues = Partial<Record<(typeof SCAN_KEYS)[number], number>>;

const SCAN_PROMPT =
  "These photos show a Tanita body composition scan printout. Read the values and reply with ONLY a JSON object with these keys " +
  "(numbers, or null if not shown): weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, water_pct, visceral_fat, bmr_kcal. Convert lb to kg if needed.";

/** Reads a Tanita printout from uploaded photos in the scan-photos bucket. null means it couldn't be read. */
export async function readScan(photoPaths: string[]): Promise<ScanValues | null> {
  const { supabase, user } = await ctx();
  const paths = photoPaths.filter((p) => p.startsWith(`${user.id}/`)).slice(0, 3);
  if (!paths.length) return null;
  try {
    const images = await Promise.all(paths.map(async (p) => {
      const { data, error } = await supabase.storage.from("scan-photos").download(p);
      if (error || !data) throw new Error(error?.message ?? "download failed");
      const type = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(data.type) ? data.type : "image/jpeg";
      return { type: "image", source: { type: "base64", media_type: type, data: Buffer.from(await data.arrayBuffer()).toString("base64") } };
    }));
    const text = await callClaude({ max_tokens: 400, messages: [{ role: "user", content: [...images, { type: "text", text: SCAN_PROMPT }] }] });
    const m = text?.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const out: ScanValues = {};
    for (const k of SCAN_KEYS) {
      const v = typeof j[k] === "string" ? Number(j[k].replace(",", ".")) : j[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch (e) {
    console.error("readScan failed", e);
    return null;
  }
}
