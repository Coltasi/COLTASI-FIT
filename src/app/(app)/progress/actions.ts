"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { getTz } from "@/lib/tz";
import { callClaude, COACH_MODEL, writeCoachRead } from "@/lib/coach";
import { SCAN_KEYS, SCAN_PROMPT, checkPage, mergePages, parseRead, scanProblems, type PageRead, type ScanValues } from "@/lib/tanita";
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
  const today = todayIn(await getTz());
  const day = String(fd.get("scanned_on") || today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today) return { error: "Pick the date the scan was taken." };
  const values: ScanValues = {};
  for (const k of SCAN_KEYS) { const v = num(fd.get(k)); if (v != null) values[k] = v; }
  const photos = fd.getAll("photo_path").map(String).filter(Boolean);
  if (values.weight_kg == null && values.body_fat_pct == null && values.muscle_mass_kg == null) return { error: "Fill in at least weight, body fat or muscle mass." };
  const problems = scanProblems(values);
  if (problems.length) return { error: problems.join(" ") };

  // One scan per day: adding photos for a day that already has a scan fills in or corrects that scan.
  const { data: existing } = await supabase.from("scans").select("id, photo_paths").eq("scanned_on", day).maybeSingle();
  let id: string | undefined;
  if (existing) {
    const { error } = await supabase.from("scans")
      .update({ ...values, photo_paths: [...((existing.photo_paths as string[]) ?? []), ...photos] })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    id = existing.id;
  } else {
    const { data, error } = await supabase.from("scans").insert({ scanned_on: day, ...values, photo_paths: photos }).select("id").single();
    if (error) return { error: error.message };
    id = data?.id;
  }
  after(async () => {
    try {
      await writeCoachRead(supabase, { kind: "scan", sourceId: id });
    } catch (e) {
      console.error("Coach read failed", e);
    }
  });
  revalidatePath("/", "layout");
  redirect("/progress");
}

export type { ScanValues };

/** Scan photos are read with a stronger model than the Coach: misread LCD digits are the main failure. */
const SCAN_MODEL = "claude-sonnet-5-5";

async function readPhoto(image: unknown): Promise<PageRead | null> {
  const ask = (model: string) => callClaude({ model, max_tokens: 400, messages: [{ role: "user", content: [image, { type: "text", text: SCAN_PROMPT }] }] });
  return parseRead((await ask(SCAN_MODEL)) ?? (await ask(COACH_MODEL)));
}

/**
 * Reads Tanita console photos (one page per photo) from the scan-photos bucket. Each photo is read and checked on
 * its own (see lib/tanita); a photo whose numbers don't check out is read once more, and if it still fails, its
 * values are left blank with a note saying why, rather than filled in wrong. null means nothing could be read.
 */
export async function readScan(photoPaths: string[]): Promise<{ values: ScanValues; problems: string[] } | null> {
  const { supabase, user } = await ctx();
  const paths = photoPaths.filter((p) => p.startsWith(`${user.id}/`)).slice(0, 8);
  if (!paths.length) return null;
  const pages = await Promise.all(paths.map(async (p) => {
    try {
      const { data, error } = await supabase.storage.from("scan-photos").download(p);
      if (error || !data) return null;
      const type = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(data.type) ? data.type : "image/jpeg";
      const image = { type: "image", source: { type: "base64", media_type: type, data: Buffer.from(await data.arrayBuffer()).toString("base64") } };
      let first = await readPhoto(image);
      let checked = first ? checkPage(first) : null;
      if (!checked || checked.issue) {
        const again = await readPhoto(image);
        const second = again ? checkPage(again) : null;
        if (second && (!second.issue || !checked)) { first = again; checked = second; }
      }
      return checked;
    } catch (e) {
      console.error("readScan photo failed", e);
      return null;
    }
  }));
  const ok = pages.filter((x): x is NonNullable<typeof x> => !!x);
  if (!ok.length) return null;
  const { values, issues } = mergePages(ok);
  if (!Object.keys(values).length) return null;
  return { values, problems: [...issues, ...scanProblems(values)] };
}
