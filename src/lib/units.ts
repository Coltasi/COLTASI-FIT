export type Units = "metric" | "imperial";
const LB = 2.20462;

/** Display a stored kg value in the viewer's units, e.g. 22.5 -> "22.5" (kg) or "49.6" (lb). */
export function w(kg: number | null | undefined, units: Units, digits = 1): string {
  if (kg == null || Number.isNaN(Number(kg))) return "–";
  const v = units === "imperial" ? Number(kg) * LB : Number(kg);
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits);
}
export const unit = (units: Units) => (units === "imperial" ? "lb" : "kg");
/** Convert a value typed in the viewer's units back to kg for storage. */
export function toKg(v: number, units: Units): number {
  return units === "imperial" ? Math.round((v / LB) * 100) / 100 : v;
}
export function signed(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toFixed(digits)}`;
}
export const fmtInt = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));
