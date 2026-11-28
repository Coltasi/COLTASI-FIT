import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { dayTotals } from "@/lib/energy";
import { activeBreak, getBreaks } from "@/lib/breaks";
import { fetchAll } from "@/lib/fetch-all";
import { HabitsChart, type HabitDay, type HabitKey } from "./habits-chart";

/**
 * Loads two years of sleep, steps and food (enough for 1Y and the year before it) for the Daily habits chart.
 * Everything stops at yesterday. Food days on a holiday break are judged against maintenance (TDEE).
 */
export async function HabitsTrend({ supabase, today, kcalTarget, tdee, proteinTarget }: {
  supabase: Supa; today: string; kcalTarget: number | null; tdee: number | null; proteinTarget: number | null;
}) {
  const last = addDays(today, -1);
  const from = addDays(last, -730);
  const [{ data: sleep }, { data: steps }, food, breaks] = await Promise.all([
    supabase.from("sleep_logs").select("night_of, hours").gte("night_of", from).lte("night_of", last).order("night_of"),
    supabase.from("step_logs").select("day, steps").gte("day", from).lte("day", last).order("day"),
    fetchAll((a, b) => supabase.from("food_logs").select("day, kcal, protein_g").gte("day", from).lte("day", last).order("id").range(a, b)),
    getBreaks(supabase),
  ]);
  const data: Record<HabitKey, HabitDay[]> = {
    sleep: ((sleep ?? []) as { night_of: string; hours: number | string | null }[]).filter((r) => r.hours != null).map((r) => ({ day: r.night_of, value: Number(r.hours) })),
    steps: ((steps ?? []) as { day: string; steps: number | string }[]).map((r) => ({ day: r.day, value: Number(r.steps) })),
    // A food day counts once it has a real day's eating logged (1,000 kcal or more), so a forgotten day isn't scored as a win.
    food: dayTotals(food as { day: string; kcal: number; protein_g: number }[])
      .filter((d) => d.kcal >= 1000)
      .map((d) => ({ day: d.day, value: d.kcal, protein: d.protein, target: activeBreak(breaks, d.day) && tdee ? tdee : kcalTarget })),
  };
  return <HabitsChart data={data} lastDay={last} kcalTarget={kcalTarget} proteinTarget={proteinTarget} />;
}
