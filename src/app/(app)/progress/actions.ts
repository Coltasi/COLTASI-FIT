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
  const problems = scanProblems(row as unknown as ScanValues);
  if (problems.length) return { error: problems.join(" ") };
  const { data: scan, error } = await supabase.from("scans").insert(row).select("id").single();
  if (error) return { error: error.message };
  after(async () => {
    try {
      await writeCoachRead(supabase, { kind: "scan", sourceId: scan?.id });
    } catch (e) {
      console.error("Coach read failed", e);
    }
  });
  revalidatePath("/", "layout");
  redirect("/progress");
}

const SCAN_KEYS = ["weight_kg", "body_fat_pct", "fat_mass_kg", "muscle_mass_kg", "water_pct", "visceral_fat", "bmr_kcal"] as const;
export type ScanValues = Partial<Record<(typeof SCAN_KEYS)[number], number>>;

/** Plausible ranges for an adult. Anything outside is a misread or a typo. */
const RANGES: Record<(typeof SCAN_KEYS)[number], [number, number, string]> = {
  weight_kg: [30, 300, "Weight"],
  body_fat_pct: [3, 60, "Body fat %"],
  fat_mass_kg: [1, 150, "Fat mass"],
  muscle_mass_kg: [20, 130, "Muscle mass"],
  water_pct: [30, 75, "Water %"],
  visceral_fat: [1, 59, "Visceral fat"],
  bmr_kcal: [800, 5000, "BMR"],
};

/** Problems with a set of scan values, worded for the form. Empty means it looks right. */
function scanProblems(v: ScanValues): string[] {
  const out: string[] = [];
  for (const k of SCAN_KEYS) {
    const x = v[k];
    if (x == null) continue;
    const [lo, hi, label] = RANGES[k];
    if (x < lo || x > hi) out.push(`${label} of ${x} can't be right (expected ${lo} to ${hi}).`);
  }
  if (v.weight_kg && v.body_fat_pct && v.fat_mass_kg) {
    const expect = (v.weight_kg * v.body_fat_pct) / 100;
    if (Math.abs(expect - v.fat_mass_kg) > 2) out.push(`Fat mass ${v.fat_mass_kg} kg doesn't match ${v.body_fat_pct}% of ${v.weight_kg} kg (about ${expect.toFixed(1)} kg). One of them is off.`);
  }
  if (v.muscle_mass_kg && v.weight_kg && v.muscle_mass_kg >= v.weight_kg) out.push("Muscle mass can't be more than your weight.");
  return out;
}

const SCAN_PROMPT =
  "This photo shows the screen of a Tanita MC-780MA-N body composition monitor (or occasionally its paper printout).\n" +
  "On the console, the row of icons under the screen reads FAT, Muscle, Water, Visceral, BMR. A small red light under ONE of them shows which page is on screen. " +
  "Ignore the LEFT panel entirely (TRUNK / ARM / LEG are per-body-part numbers). Read only the RIGHT panel: the top line is Weight in kg, " +
  "below it is a percentage line (if shown) and a kg or plain number line.\n" +
  "Page meanings: FAT page: % = body fat %, kg = fat mass. Muscle page: kg = muscle mass (the % on this page is NOT body fat, ignore it). " +
  "Water page: % = body water %. Visceral page: the number is the visceral fat rating. BMR page: the number is BMR in kcal.\n" +
  "LCD digits can look alike: check 1 vs 7, 5 vs 6, 8 vs 0 carefully and keep the decimal point where it is.\n" +
  'Reply with ONLY JSON: {"page": "fat"|"muscle"|"water"|"visceral"|"bmr"|"printout"|"unknown", "weight_kg": number|null, "percent": number|null, "kg": number|null, "number": number|null, ' +
  '"printout": null or, only for a paper printout, an object with weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, water_pct, visceral_fat, bmr_kcal}.';

const toNum = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Maps one photo's reading onto scan fields using which page the console was showing. */
function fromPage(j: any): ScanValues {
  const out: ScanValues = {};
  const w = toNum(j?.weight_kg), pct = toNum(j?.percent), kg = toNum(j?.kg), num = toNum(j?.number);
  if (w != null) out.weight_kg = w;
  switch (j?.page) {
    case "fat": if (pct != null) out.body_fat_pct = pct; if (kg != null) out.fat_mass_kg = kg; break;
    case "muscle": if (kg != null) out.muscle_mass_kg = kg; break;
    case "water": if (pct != null) out.water_pct = pct; break;
    case "visceral": { const v = num ?? kg ?? pct; if (v != null) out.visceral_fat = v; break; }
    case "bmr": { const v = num ?? kg; if (v != null) out.bmr_kcal = v; break; }
    case "printout": for (const k of SCAN_KEYS) { const v = toNum(j?.printout?.[k]); if (v != null) out[k] = v; } break;
  }
  return out;
}

/**
 * Reads Tanita console photos (one page per photo) from the scan-photos bucket. Each photo is read on its own,
 * then merged by page, and anything outside a plausible range is dropped. null means nothing could be read.
 */
export async function readScan(photoPaths: string[]): Promise<{ values: ScanValues; problems: string[] } | null> {
  const { supabase, user } = await ctx();
  const paths = photoPaths.filter((p) => p.startsWith(`${user.id}/`)).slice(0, 6);
  if (!paths.length) return null;
  const reads = await Promise.all(paths.map(async (p) => {
    try {
      const { data, error } = await supabase.storage.from("scan-photos").download(p);
      if (error || !data) return null;
      const type = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(data.type) ? data.type : "image/jpeg";
      const image = { type: "image", source: { type: "base64", media_type: type, data: Buffer.from(await data.arrayBuffer()).toString("base64") } };
      const text = await callClaude({ max_tokens: 300, messages: [{ role: "user", content: [image, { type: "text", text: SCAN_PROMPT }] }] });
      const m = text?.match(/\{[\s\S]*\}/);
      return m ? fromPage(JSON.parse(m[0])) : null;
    } catch (e) {
      console.error("readScan photo failed", e);
      return null;
    }
  }));
  const merged: ScanValues = {};
  for (const r of reads) for (const k of SCAN_KEYS) if (r?.[k] != null && merged[k] == null) merged[k] = r[k];
  for (const k of SCAN_KEYS) {
    const x = merged[k];
    if (x != null && (x < RANGES[k][0] || x > RANGES[k][1])) delete merged[k];
  }
  if (!Object.keys(merged).length) return null;
  return { values: merged, problems: scanProblems(merged) };
}
