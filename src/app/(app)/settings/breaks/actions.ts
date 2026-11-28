"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function saveBreak(_prev: { error: string | null }, fd: FormData): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");

  const id = String(fd.get("id") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60) || null;
  const start = String(fd.get("start_date") ?? "");
  const end = String(fd.get("end_date") ?? "");
  const perWeek = Math.round(Number(fd.get("workouts_per_week")));
  if (!ISO.test(start) || !ISO.test(end)) return { error: "Pick a start and an end date." };
  if (end < start) return { error: "The end date is before the start date." };
  if (!(perWeek >= 1 && perWeek <= 7)) return { error: "Workouts per week must be between 1 and 7." };

  const row = { name, start_date: start, end_date: end, workouts_per_week: perWeek };
  const { error } = id
    ? await supabase.from("breaks").update(row).eq("id", id)
    : await supabase.from("breaks").insert(row);
  if (error) return { error: "Couldn't save the break. Try again." };

  revalidatePath("/", "layout");
  redirect("/settings/breaks");
}

export async function deleteBreak(fd: FormData) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  const id = String(fd.get("id") ?? "");
  if (id) await supabase.from("breaks").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/settings/breaks");
}
