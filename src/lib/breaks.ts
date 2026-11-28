/**
 * Holiday mode. A break is a date range you enter yourself, with a workouts-per-week target.
 * While one is active the app suggests the two holiday kettlebell workouts (alternating),
 * moves the calorie target to maintenance (TDEE) and keeps protein where it is.
 */
import type { Supa, ProgramDay } from "./data";
import { addDays } from "./dates";

export type Break = { id: string; name: string | null; start_date: string; end_date: string; workouts_per_week: number };

/** The bells travel workouts are written for. The Coach never suggests heavier while you're away. */
export const TRAVEL_BELLS = [8, 12];

export async function getBreaks(supabase: Supa): Promise<Break[]> {
  const { data } = await supabase.from("breaks").select("id, name, start_date, end_date, workouts_per_week").order("start_date");
  return (data ?? []) as Break[];
}

export function activeBreak(breaks: Break[], today: string): Break | null {
  return breaks.find((b) => b.start_date <= today && today <= b.end_date) ?? null;
}

export async function getActiveBreak(supabase: Supa, today: string): Promise<Break | null> {
  const { data } = await supabase.from("breaks").select("id, name, start_date, end_date, workouts_per_week")
    .lte("start_date", today).gte("end_date", today).order("start_date").limit(1);
  return ((data ?? [])[0] as Break | undefined) ?? null;
}

export function breakLabel(b: Break): string {
  return b.name?.trim() || "Holiday";
}

/** Sunday-first week, matching the week strip on Today. */
export function weekStart(today: string): string {
  return addDays(today, -new Date(today + "T12:00:00Z").getUTCDay());
}

/** The holiday workout to suggest next: whichever of A/B you did least recently. */
export function nextHolidayDay(program: ProgramDay[], lastHolidayDayId: string | null): ProgramDay | null {
  const days = program.filter((d) => d.program === "holiday").sort((a, b) => a.day_order - b.day_order);
  if (!days.length) return null;
  const i = days.findIndex((d) => d.id === lastHolidayDayId);
  return i === -1 ? days[0] : days[(i + 1) % days.length];
}
