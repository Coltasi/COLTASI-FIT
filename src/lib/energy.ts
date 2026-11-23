import type { Supa } from "@/lib/data";
import { addDays, daysBetween } from "@/lib/dates";
import { weeklyRate } from "@/lib/coach";

/** kcal per kg of body weight change (the Built With Science spreadsheet's figure). */
export const KCAL_PER_KG = 7716;
/** A logged day under this is treated as incomplete and left out of the TDEE math. */
const MIN_DAY_KCAL = 1000;
const WINDOW_DAYS = 21;
/** How far back food can be logged or edited. */
export const FOOD_DAYS_BACK = 60;
const MIN_LOGGED_DAYS = 14;

export type DayTotal = { day: string; kcal: number; protein: number };

export type Energy = {
  tdee: number | null;
  /** "measured" = food log + weight trend; "formula" = Katch-McArdle from the latest scan. */
  source: "measured" | "formula" | null;
  loggedDays: number;
  daysNeeded: number;
  avgKcal: number | null;
  rateKgWeek: number | null;
  /** Calories that would hit the profile's target rate at this TDEE. */
  suggestedTarget: number | null;
};

export function dayTotals(rows: { day: string; kcal: number; protein_g: number | string }[]): DayTotal[] {
  const m = new Map<string, DayTotal>();
  for (const r of rows) {
    const t = m.get(r.day) ?? { day: r.day, kcal: 0, protein: 0 };
    t.kcal += Number(r.kcal);
    t.protein += Number(r.protein_g);
    m.set(r.day, t);
  }
  return [...m.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** Katch-McArdle BMR from lean mass, times the spreadsheet's 1.5 activity factor for men (1.55 women). */
export function formulaTdee(weightKg: number, bodyFatPct: number, sex: string | null): number {
  const lean = weightKg * (1 - bodyFatPct / 100);
  return Math.round((370 + 21.6 * lean) * (sex === "female" ? 1.55 : 1.5));
}

export async function getEnergy(supabase: Supa, today: string, sex: string | null, targetRate: number | null): Promise<Energy> {
  const from = addDays(today, -WINDOW_DAYS);
  const [{ data: food }, { data: weighs }, { data: scans }, { data: lastScan }] = await Promise.all([
    supabase.from("food_logs").select("day, kcal, protein_g").gte("day", from).lt("day", today),
    supabase.from("weigh_ins").select("measured_on, weight_kg").gte("measured_on", from),
    supabase.from("scans").select("scanned_on, weight_kg").gte("scanned_on", from).not("weight_kg", "is", null),
    supabase.from("scans").select("weight_kg, body_fat_pct").not("body_fat_pct", "is", null).not("weight_kg", "is", null).order("scanned_on", { ascending: false }).limit(1),
  ]);

  const days = dayTotals((food ?? []) as any[]).filter((d) => d.kcal >= MIN_DAY_KCAL);
  const byDate = new Map<string, number>();
  for (const w of (weighs ?? []) as any[]) byDate.set(w.measured_on, Number(w.weight_kg));
  for (const s of (scans ?? []) as any[]) if (!byDate.has(s.scanned_on)) byDate.set(s.scanned_on, Number(s.weight_kg));
  const points = [...byDate].map(([measured_on, weight_kg]) => ({ measured_on, weight_kg }));
  const span = points.length >= 2 ? daysBetween(points.map((p) => p.measured_on).sort()[0], points.map((p) => p.measured_on).sort().at(-1)!) : 0;
  const rate = weeklyRate(points);
  const avgKcal = days.length ? Math.round(days.reduce((s, d) => s + d.kcal, 0) / days.length) : null;

  let tdee: number | null = null;
  let source: Energy["source"] = null;
  if (days.length >= MIN_LOGGED_DAYS && rate != null && span >= 10 && avgKcal != null) {
    // Eating avgKcal and changing by `rate` kg/week means you burn avgKcal minus that change's energy.
    tdee = Math.round(avgKcal - (rate * KCAL_PER_KG) / 7);
    source = "measured";
  } else if (lastScan?.[0]) {
    tdee = formulaTdee(Number(lastScan[0].weight_kg), Number(lastScan[0].body_fat_pct), sex);
    source = "formula";
  }
  const suggestedTarget = tdee != null && targetRate != null ? Math.round((tdee + (targetRate * KCAL_PER_KG) / 7) / 50) * 50 : null;
  return { tdee, source, loggedDays: days.length, daysNeeded: MIN_LOGGED_DAYS, avgKcal, rateKgWeek: rate, suggestedTarget };
}
