"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";
import { getContext } from "@/lib/data";
import { addDays } from "@/lib/dates";

export async function saveSteps(_prev: { error: string | null }, fd: FormData) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  const { today } = await getContext();
  const day = String(fd.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || day < addDays(today, -60)) return { error: "Pick a day within the last 60 days." };
  const steps = Number(fd.get("steps"));
  if (!Number.isInteger(steps) || steps < 0 || steps > 200000) return { error: "Steps should be a whole number up to 200,000." };
  const { error } = await supabase.from("step_logs").upsert(
    { day, steps, source: "manual", updated_at: new Date().toISOString() },
    { onConflict: "user_id,day" },
  );
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(fd.get("next") === "/steps" ? "/steps" : "/");
}

export async function deleteSteps(fd: FormData) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  const day = String(fd.get("day") ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) await supabase.from("step_logs").delete().eq("day", day);
  revalidatePath("/", "layout");
  redirect("/steps");
}
