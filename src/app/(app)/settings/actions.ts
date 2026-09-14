"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error: string | null };

export async function updateUnits(units: "metric" | "imperial") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("profiles").update({ units }).eq("id", user.id);
  revalidatePath("/settings");
}

export async function updateProfile(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const sex = String(formData.get("sex") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "").trim();
  const heightCm = formData.get("height_cm");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      sex: sex || null,
      birth_date: birthDate || null,
      height_cm: heightCm ? Number(heightCm) : null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  redirect("/settings");
}

// Nutrition target math ported directly from the Built With Science nutrition
// spreadsheet's CALCULATIONS sheet (cells AN22, BD15-BD22). BMR/TDEE use
// Katch-McArdle with the measured body-fat % for lean mass, scaled by a
// gender multiplier that already bakes in activity level. Protein and fat
// multipliers are bracketed by sex + body-fat %, same as the spreadsheet.
// This is the "initial" calculation (spreadsheet Step 1-3) - the adaptive
// week-4-onward recalculation (avg calories + weight-trend adjustment) is a
// separate, not-yet-built feature.
function computeTargets(opts: {
  sex: "male" | "female";
  weightKg: number;
  bodyFatPct: number;
  rateKgPerWeek: number;
}) {
  const { sex, weightKg, bodyFatPct, rateKgPerWeek } = opts;

  const leanMassKg = weightKg * ((100 - bodyFatPct) / 100);
  const genderMultiplier = sex === "male" ? 1.5 : 1.55;
  const bmr = 370 + 21.6 * leanMassKg;
  const tdee = bmr * genderMultiplier;

  const proteinMultiplier =
    sex === "male"
      ? bodyFatPct < 20
        ? 2.2
        : bodyFatPct <= 25
          ? 1.76
          : 1.606
      : 1.7778;

  const fatMultiplier = sex === "male" ? (bodyFatPct < 25 ? 0.22 : 0.25) : 0.3;
  const calorieFloor = sex === "male" ? 1500 : 1200;

  const dailyAdjustment = (rateKgPerWeek * 7700) / 7;
  const targetKcal = Math.max(calorieFloor, Math.round(tdee + dailyAdjustment));

  const proteinG = Math.round(weightKg * proteinMultiplier);
  const fatG = Math.round((fatMultiplier * targetKcal) / 9);
  const carbsG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));

  const phase = rateKgPerWeek < 0 ? "Cut" : rateKgPerWeek > 0 ? "Lean Bulk" : "Maintain";

  return { tdee: Math.round(tdee), targetKcal, proteinG, fatG, carbsG, phase };
}

export async function updateGoals(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rateKgPerWeek = Number(formData.get("rate_kg_per_week") ?? 0);

  const { data: profile } = await supabase
    .from("profiles")
    .select("sex")
    .eq("id", user.id)
    .single();

  if (!profile?.sex) {
    return { error: "Set your sex in Profile first — it's needed for the calculation." };
  }

  const { data: scan } = await supabase
    .from("body_comp_scans")
    .select("weight_kg, body_fat_pct")
    .eq("user_id", user.id)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scan?.weight_kg || scan.body_fat_pct == null) {
    return { error: "Log a body-comp scan with weight and body fat % first." };
  }

  const result = computeTargets({
    sex: profile.sex === "female" ? "female" : "male",
    weightKg: scan.weight_kg,
    bodyFatPct: scan.body_fat_pct,
    rateKgPerWeek,
  });

  const { error } = await supabase.from("nutrition_targets").insert({
    user_id: user.id,
    effective_date: new Date().toISOString().slice(0, 10),
    phase: result.phase,
    tdee_kcal: result.tdee,
    target_kcal: result.targetKcal,
    target_protein_g: result.proteinG,
    target_fat_g: result.fatG,
    target_carbs_g: result.carbsG,
    target_rate_kg_per_week: rateKgPerWeek,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/goals");
  revalidatePath("/");
  revalidatePath("/log");
  redirect("/settings/goals");
}
