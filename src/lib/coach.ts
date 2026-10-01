import type { Supa } from "@/lib/data";
import { daysBetween } from "@/lib/dates";
import { currentUser } from "@/lib/supabase/user";

export const COACH_MODEL = "claude-haiku-4-5-20251001";

/** kg per week from a least-squares fit over the given weigh-ins (oldest first or any order). */
export function weeklyRate(points: { measured_on: string; weight_kg: number }[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => (a.measured_on < b.measured_on ? -1 : 1));
  const x = sorted.map((p) => daysBetween(sorted[0].measured_on, p.measured_on));
  const y = sorted.map((p) => Number(p.weight_kg));
  const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  const den = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  if (!den) return null;
  const slope = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / den;
  return slope * 7;
}

type Facts = {
  sessionTitle?: string;
  lifts?: { name: string; top: number | null; reps: (number | null)[]; prevTop: number | null }[];
  weighIns: { measured_on: string; weight_kg: number }[];
  rate: number | null;
  targetRate: number | null;
  targetKcal: number | null;
  sleep: { night_of: string; hours: number; wake_feeling: string | null; flags: string[] } | null;
};

async function gatherFacts(supabase: Supa, kind: "session" | "weigh_in", sourceId?: string): Promise<Facts> {
  const user = await currentUser(supabase);
  const [{ data: prof }, { data: wis }, { data: sl }] = await Promise.all([
    supabase.from("profiles").select("target_rate_kg_week, target_kcal").eq("id", user?.id ?? "").single(),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(6),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags").order("night_of", { ascending: false }).limit(1),
  ]);
  const weighIns = ((wis ?? []) as any[]).map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) }));
  const facts: Facts = {
    weighIns,
    rate: weeklyRate(weighIns.slice(0, 4)),
    targetRate: prof?.target_rate_kg_week == null ? null : Number(prof.target_rate_kg_week),
    targetKcal: prof?.target_kcal ?? null,
    sleep: (sl?.[0] as any) ?? null,
  };
  if (kind === "session" && sourceId) {
    const { data: s } = await supabase
      .from("sessions")
      .select("title, session_exercises(exercise_id, position, exercises(name), session_sets(weight_kg, reps, done))")
      .eq("id", sourceId)
      .single();
    if (s) {
      facts.sessionTitle = s.title;
      const ses = ((s.session_exercises ?? []) as any[]).sort((a, b) => a.position - b.position);
      const ids = ses.map((x) => x.exercise_id);
      const prevTops = new Map<string, number>();
      if (ids.length) {
        const { data: prev } = await supabase
          .from("session_exercises")
          .select("exercise_id, session_id, sessions!inner(status, started_at), session_sets(weight_kg, done)")
          .in("exercise_id", ids)
          .eq("sessions.status", "done")
          .neq("session_id", sourceId);
        for (const r of ((prev ?? []) as any[]).sort((a, b) => (a.sessions.started_at < b.sessions.started_at ? 1 : -1))) {
          if (prevTops.has(r.exercise_id)) continue;
          const ws = (r.session_sets ?? []).filter((z: any) => z.done && z.weight_kg != null).map((z: any) => Number(z.weight_kg));
          if (ws.length) prevTops.set(r.exercise_id, Math.max(...ws));
        }
      }
      facts.lifts = ses
        .map((x) => {
          const done = (x.session_sets ?? []).filter((z: any) => z.done);
          const ws = done.filter((z: any) => z.weight_kg != null).map((z: any) => Number(z.weight_kg));
          return { name: x.exercises?.name ?? "", top: ws.length ? Math.max(...ws) : null, reps: done.map((z: any) => z.reps), prevTop: prevTops.get(x.exercise_id) ?? null };
        })
        .filter((l) => l.reps.length);
    }
  }
  return facts;
}

type Read = { headline: string; lifting: string | null; weight: string | null; recovery: string | null };
const r1 = (n: number) => Math.round(n * 10) / 10;

function ruleRead(kind: "session" | "weigh_in", f: Facts): Read {
  let lifting: string | null = null;
  if (f.lifts?.length) {
    const ups = f.lifts.filter((l) => l.top != null && l.prevTop != null && l.top > l.prevTop);
    const downs = f.lifts.filter((l) => l.top != null && l.prevTop != null && l.top < l.prevTop);
    if (ups.length) lifting = `${ups.map((l) => `${l.name} up to ${r1(l.top!)} kg`).slice(0, 2).join(", ")}. Hold the new weight until every set hits the top of the range.`;
    else if (downs.length) lifting = `${downs[0].name} came in lighter than last time. One off day is noise; watch it next session.`;
    else lifting = `${f.lifts.length} lifts logged at last time's weights. Add a rep before you add weight.`;
  }
  let weight: string | null = null;
  if (f.rate != null && f.targetRate != null) {
    const behind = f.targetRate < 0 ? f.rate > f.targetRate * 0.75 : f.rate < f.targetRate * 0.75;
    weight = `Recent weigh-ins average ${r1(f.rate)} kg/week against a ${r1(f.targetRate)} target.` +
      (behind ? (f.targetKcal ? ` If next Monday is flat again, trim about 150 kcal from your ${f.targetKcal.toLocaleString("en-US")} target.` : " If next Monday is flat again, trim about 150 kcal a day.") : " On track.");
  } else if (f.weighIns.length) {
    weight = `Latest weigh-in ${r1(f.weighIns[0].weight_kg)} kg. A few more Mondays and the trend will be clear.`;
  } else {
    weight = "No weigh-ins yet. Log one on Monday morning so the trend can start.";
  }
  let recovery: string | null = null;
  if (f.sleep) recovery = `${r1(Number(f.sleep.hours))} hours${f.sleep.wake_feeling ? `, woke ${f.sleep.wake_feeling}` : ""}.` + (Number(f.sleep.hours) < 6 ? " Keep tomorrow's session honest, not heroic." : "");
  const headline = kind === "session"
    ? `${f.sessionTitle ?? "Session"} logged.${lifting && lifting.includes(" up to ") ? " Strength is moving." : ""}`
    : "Weigh-in logged.";
  return { headline, lifting: kind === "session" ? lifting : null, weight, recovery };
}

async function haikuRead(kind: "session" | "weigh_in", f: Facts): Promise<Read | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: 400,
      system:
        "You are the coach in a personal training app. Write a short, direct read after a " +
        (kind === "session" ? "workout session" : "weekly weigh-in") +
        ". Be specific with the numbers given, never invent numbers, no hype, no emoji, no em dashes. " +
        'Reply with JSON only: {"headline": one sentence, "lifting": 1-2 sentences or null, "weight": 1-2 sentences or null, "recovery": one sentence or null}. ' +
        "A stall needs 2-3 flat weeks before you suggest a calorie change; suggest about 150 kcal when you do.",
      messages: [{ role: "user", content: JSON.stringify(f) }],
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const text: string = body?.content?.[0]?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const j = JSON.parse(m[0]);
  if (!j.headline) return null;
  return { headline: String(j.headline), lifting: j.lifting ?? null, weight: j.weight ?? null, recovery: j.recovery ?? null };
}

export async function writeCoachRead(supabase: Supa, { kind, sourceId }: { kind: "session" | "weigh_in"; sourceId?: string }) {
  const facts = await gatherFacts(supabase, kind, sourceId);
  let read: Read | null = null;
  let model = "rules";
  try {
    read = await haikuRead(kind, facts);
    if (read) model = COACH_MODEL;
  } catch {}
  read ??= ruleRead(kind, facts);
  await supabase.from("coach_reads").insert({ kind, source_id: sourceId ?? null, model, ...read });
}

export async function askCoach(supabase: Supa, question: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "Coach can't answer questions yet: the Anthropic API key hasn't been added to the app's settings on Vercel.";
  const facts = await gatherFacts(supabase, "weigh_in");
  const { data: recent } = await supabase.from("sessions").select("title, session_date, status").order("started_at", { ascending: false }).limit(8);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: 500,
      system: "You are the coach in a personal training app. Answer in under 120 words, plainly, using the user's data. Never invent numbers. No emoji, no em dashes. You are not a doctor; for pain or injury, say to see one.",
      messages: [{ role: "user", content: `My data: ${JSON.stringify({ ...facts, recentSessions: recent })}\n\nQuestion: ${question}` }],
    }),
  });
  if (!res.ok) return "Coach couldn't answer just now. Try again in a minute.";
  const body = await res.json();
  return String(body?.content?.[0]?.text ?? "Coach couldn't answer just now.");
}
