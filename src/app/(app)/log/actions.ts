"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LogMealState = { error: string | null };

export async function logMeal(
  _prevState: LogMealState,
  formData: FormData,
): Promise<LogMealState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mealType = String(formData.get("meal_type") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const calories = formData.get("calories");
  const protein = formData.get("protein_g");
  const carbs = formData.get("carbs_g");
  const fat = formData.get("fat_g");
  const notes = String(formData.get("notes") ?? "").trim();
  const photo = formData.get("photo");

  if (!name) {
    return { error: "Give the meal a name." };
  }

  let photoStoragePath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const ext = photo.name.includes(".") ? photo.name.split(".").pop() : "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("meal-photos")
      .upload(path, photo, { contentType: photo.type || "image/jpeg" });
    if (uploadError) {
      return { error: `Photo upload failed: ${uploadError.message}` };
    }
    photoStoragePath = path;
  }

  const { error } = await supabase.from("meals").insert({
    user_id: user.id,
    logged_at: new Date().toISOString(),
    meal_type: mealType || null,
    name,
    calories: calories ? Number(calories) : null,
    protein_g: protein ? Number(protein) : null,
    carbs_g: carbs ? Number(carbs) : null,
    fat_g: fat ? Number(fat) : null,
    photo_storage_path: photoStoragePath,
    notes: notes || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log");
}

export async function deleteMeal(mealId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("meals").delete().eq("id", mealId).eq("user_id", user.id);
  revalidatePath("/log");
  revalidatePath("/");
}

function yesterdayIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type LogSleepState = { error: string | null };

export async function logSleep(
  _prevState: LogSleepState,
  formData: FormData,
): Promise<LogSleepState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hours = Number(formData.get("hours") ?? 0);
  const wokeFeeling = String(formData.get("woke_feeling") ?? "").trim();
  const tags = formData.getAll("tags").map(String);
  const notes = String(formData.get("notes") ?? "").trim();
  const logDate = yesterdayIso();

  if (!hours || hours <= 0) {
    return { error: "Enter how many hours you slept." };
  }

  const { data: existing } = await supabase
    .from("sleep_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("log_date", logDate)
    .maybeSingle();

  const payload = {
    hours,
    woke_feeling: wokeFeeling || null,
    tags: tags.length ? tags : null,
    notes: notes || null,
  };

  const { error } = existing
    ? await supabase.from("sleep_logs").update(payload).eq("id", existing.id)
    : await supabase
        .from("sleep_logs")
        .insert({ user_id: user.id, log_date: logDate, ...payload });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/log");
  redirect("/");
}
