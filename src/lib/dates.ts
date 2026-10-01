/** YYYY-MM-DD for "now" in the given time zone. */
export function todayIn(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing iso. */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(new Date(iso + "T12:00:00Z"));

/** "Thu Oct 1" */
export const fmtDay = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric" });
/** "Oct 1" */
export const fmtShort = (iso: string) => fmt(iso, { month: "short", day: "numeric" });
/** "Thursday, Oct 1" */
export const fmtLong = (iso: string) => fmt(iso, { weekday: "long", month: "short", day: "numeric" });
/** "Thu" */
export const fmtDow = (iso: string) => fmt(iso, { weekday: "short" });
/** "Oct" */
export const fmtMonth = (iso: string) => fmt(iso, { month: "short" });
