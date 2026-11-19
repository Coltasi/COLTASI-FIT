"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";

async function ctx() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

const PREFS = ["units", "notify_sleep", "notify_weigh_in", "notify_workout"] as const;

export async function setPref(field: (typeof PREFS)[number], value: string | boolean) {
  if (!PREFS.includes(field)) return;
  if (field === "units" && value !== "metric" && value !== "imperial") return;
  const { supabase, user } = await ctx();
  await supabase.from("profiles").update({ [field]: value }).eq("id", user.id);
  revalidatePath("/", "layout");
}

const n = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(",", ".").trim();
  if (!s) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
};

export async function saveProfile(_prev: { error: string | null }, fd: FormData) {
  const { supabase, user } = await ctx();
  const kbs = String(fd.get("kettlebells_kg") ?? "").split(/[,\s]+/).map(Number).filter((x) => x > 0).sort((a, b) => a - b);
  const phase = String(fd.get("phase") ?? "cut");
  const sex = String(fd.get("sex") ?? "");
  const rate = n(fd.get("target_rate_kg_week"));
  const { error } = await supabase.from("profiles").update({
    display_name: String(fd.get("display_name") ?? "").trim() || null,
    height_cm: n(fd.get("height_cm")),
    sex: sex === "male" || sex === "female" ? sex : null,
    birth_year: n(fd.get("birth_year")),
    phase: ["cut", "maintain", "bulk"].includes(phase) ? phase : "cut",
    target_rate_kg_week: rate == null ? null : phase === "cut" ? -Math.abs(rate) : phase === "bulk" ? Math.abs(rate) : 0,
    tdee_kcal: n(fd.get("tdee_kcal")),
    target_kcal: n(fd.get("target_kcal")),
    protein_g: n(fd.get("protein_g")),
    carbs_g: n(fd.get("carbs_g")),
    fat_g: n(fd.get("fat_g")),
    kettlebells_kg: kbs.length ? kbs : [8, 12, 16, 20, 24, 30],
  }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }, timezone: string, userAgent: string) {
  const { supabase, user } = await ctx();
  try { Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { return { error: "Bad time zone." }; }
  if (!sub.endpoint.startsWith("https://") || !sub.p256dh || !sub.auth) return { error: "Bad subscription." };
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, timezone, user_agent: userAgent.slice(0, 200), last_seen: new Date().toISOString() },
    { onConflict: "endpoint" },
  );
  return { error: error?.message ?? null };
}

export async function removePushSubscription(endpoint: string) {
  const { supabase } = await ctx();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** Whether the server has this device saved (the phone can think it's subscribed when the server has dropped it). */
export async function hasPushSubscription(endpoint: string) {
  const { supabase } = await ctx();
  const { data } = await supabase.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
  return !!data;
}
