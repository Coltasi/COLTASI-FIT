"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { askCoach, writeCoachRead } from "@/lib/coach";
import { currentUser } from "@/lib/supabase/user";

export async function ask(_prev: { q: string; a: string } | null, fd: FormData) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  const q = String(fd.get("q") ?? "").trim().slice(0, 500);
  if (!q) return null;
  return { q, a: await askCoach(supabase, q) };
}

/** Rewrites the latest read from today's data (same kind and source), e.g. after logging sleep. */
export async function refreshRead() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  const { data } = await supabase.from("coach_reads").select("id, kind, source_id").order("created_at", { ascending: false }).limit(1);
  const last = data?.[0];
  await writeCoachRead(supabase, { kind: (last?.kind as "session" | "weigh_in" | "scan") ?? "weigh_in", sourceId: last?.source_id ?? undefined });
  // Replace, don't pile up: the refreshed read takes the old one's place.
  if (last) await supabase.from("coach_reads").delete().eq("id", last.id);
  revalidatePath("/", "layout");
}
