"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { askCoach } from "@/lib/coach";
import { currentUser } from "@/lib/supabase/user";

export async function ask(_prev: { q: string; a: string } | null, fd: FormData) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");
  const q = String(fd.get("q") ?? "").trim().slice(0, 500);
  if (!q) return null;
  return { q, a: await askCoach(supabase, q) };
}
