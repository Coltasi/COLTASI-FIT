import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";

export type StepDay = { day: string; steps: number };

/** Logged step days from the last `days` days (including today), oldest first. */
export async function getSteps(supabase: Supa, today: string, days = 30): Promise<StepDay[]> {
  const { data } = await supabase.from("step_logs").select("day, steps").gte("day", addDays(today, -(days - 1))).order("day");
  return ((data ?? []) as { day: string; steps: number }[]).map((r) => ({ day: r.day, steps: Number(r.steps) }));
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/**
 * Averages use completed days only (before today), because today's count is still growing.
 * An average needs at least 3 logged days, otherwise it's null.
 */
export function stepSummary(rows: StepDay[], today: string) {
  const within = (from: number, to: number) => rows.filter((r) => r.day >= addDays(today, from) && r.day <= addDays(today, to)).map((r) => r.steps);
  const cur = within(-7, -1);
  const prev = within(-14, -8);
  return {
    avg7: cur.length >= 3 ? avg(cur) : null,
    days7: cur.length,
    avgPrev7: prev.length >= 3 ? avg(prev) : null,
    daysPrev7: prev.length,
  };
}

export const fmtSteps = (n: number) => n.toLocaleString("en-US");
/** 8400 -> "8.4k" */
export const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
