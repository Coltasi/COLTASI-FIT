"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const FEELINGS = ["energetic", "rested", "groggy", "tired", "exhausted"];
const FLAGS = ["interrupted", "woke_early", "restless", "nightmares", "good_dreams", "slept_through"];

export async function saveSleep(_prev: { error: string | null }, fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const hours = Number(fd.get("hours"));
  if (!(hours >= 0 && hours <= 24)) return { error: "Hours should be between 0 and 24." };
  const feeling = String(fd.get("wake_feeling") ?? "");
  const { error } = await supabase.from("sleep_logs").upsert(
    {
      night_of: String(fd.get("night_of")),
      hours,
      wake_feeling: FEELINGS.includes(feeling) ? feeling : null,
      flags: fd.getAll("flags").map(String).filter((f) => FLAGS.includes(f)),
      note: String(fd.get("note") ?? "").trim() || null,
    },
    { onConflict: "user_id,night_of" },
  );
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/");
}
