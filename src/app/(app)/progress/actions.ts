"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LogScanState = { error: string | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function logScan(
  _prevState: LogScanState,
  formData: FormData,
): Promise<LogScanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scannedAt = String(formData.get("scanned_at") ?? "").trim() || todayIso();
  const weight = formData.get("weight_kg");
  const bodyFat = formData.get("body_fat_pct");
  const fatMass = formData.get("fat_mass_kg");
  const muscleMass = formData.get("muscle_mass_kg");
  const water = formData.get("water_pct");
  const visceral = formData.get("visceral_fat_rating");
  const bmr = formData.get("bmr_kcal");
  const notes = String(formData.get("notes") ?? "").trim();
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!weight) {
    return { error: "Enter at least the weight reading." };
  }

  const { data: scan, error } = await supabase
    .from("body_comp_scans")
    .insert({
      user_id: user.id,
      scanned_at: scannedAt,
      weight_kg: Number(weight),
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
      fat_mass_kg: fatMass ? Number(fatMass) : null,
      muscle_mass_kg: muscleMass ? Number(muscleMass) : null,
      water_pct: water ? Number(water) : null,
      visceral_fat_rating: visceral ? Number(visceral) : null,
      bmr_kcal: bmr ? Number(bmr) : null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error || !scan) {
    return { error: error?.message ?? "Could not save the scan." };
  }

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const ext = photo.name.includes(".") ? photo.name.split(".").pop() : "jpg";
    const path = `${user.id}/${scan.id}-${i}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("scan-photos")
      .upload(path, photo, { contentType: photo.type || "image/jpeg" });
    if (!uploadError) {
      await supabase.from("body_comp_scan_photos").insert({
        scan_id: scan.id,
        storage_path: path,
      });
    }
  }

  revalidatePath("/progress");
  revalidatePath("/");
  redirect("/progress");
}
