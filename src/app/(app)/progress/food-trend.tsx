import Link from "next/link";
import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { dayTotals } from "@/lib/energy";
import type { Units } from "@/lib/units";

const DAYS = 28;

/** Progress → Body: 4 weeks of calories against target, plus average calories and protein. */
export async function FoodTrend({ supabase, today, targetKcal, targetProtein }: {
  supabase: Supa; today: string; targetKcal: number | null; targetProtein: number | null;
  weights?: { d: string; kg: number }[]; units?: Units;
}) {
  const from = addDays(today, -(DAYS - 1));
  const { data } = await supabase.from("food_logs").select("day, kcal, protein_g").gte("day", from).lte("day", today);
  const totals = new Map(dayTotals((data ?? []) as { day: string; kcal: number; protein_g: number }[]).map((d) => [d.day, d]));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const logged = days.filter((d) => totals.has(d) && d !== today);

  if (!totals.size) {
    return (
      <div className="card" style={{ padding: "16px 18px" }}>
        <p className="sec">Food</p>
        <p className="cap" style={{ marginTop: 6, fontSize: 14 }}>Log meals in <Link href="/food">Food</Link> to see your trend here.</p>
      </div>
    );
  }

  const avgK = logged.length ? Math.round(logged.reduce((s, d) => s + totals.get(d)!.kcal, 0) / logged.length) : null;
  const avgP = logged.length ? Math.round(logged.reduce((s, d) => s + totals.get(d)!.protein, 0) / logged.length) : null;
  const maxK = Math.max(targetKcal ?? 0, ...[...totals.values()].map((t) => t.kcal)) * 1.08 || 3000;

  return (
    <Link href="/food" className="card" style={{ padding: "16px 18px", display: "grid", gap: 16, color: "var(--navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="sec">Food</p>
        <p className="cap" style={{ fontSize: 14 }}>4 weeks</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="stat">
          <b>{avgK?.toLocaleString("en-US") ?? "–"}</b>
          <span>avg kcal{targetKcal ? ` / ${targetKcal.toLocaleString("en-US")}` : ""}</span>
        </div>
        <div className="stat">
          <b>{avgP != null ? `${avgP} g` : "–"}</b>
          <span>avg protein{targetProtein ? ` / ${targetProtein} g` : ""}</span>
        </div>
      </div>

      <div style={{ position: "relative", height: 72 }} role="img" aria-label="Calories per day over the last 4 weeks, dashed line is your target, orange is over">
        {targetKcal ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(targetKcal / maxK) * 100}%`, borderTop: "1.5px dashed var(--mist)" }} />
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${DAYS}, minmax(0,1fr))`, gap: 3, alignItems: "end", height: "100%" }}>
          {days.map((d) => {
            const t = totals.get(d);
            const over = t && targetKcal && t.kcal > targetKcal;
            return <div key={d} style={{ height: t ? `${Math.max(4, (t.kcal / maxK) * 100)}%` : 3, borderRadius: 2, background: !t ? "var(--line-soft)" : over ? "var(--ember)" : "var(--kingfisher)", opacity: d === today ? 0.4 : 1 }} />;
          })}
        </div>
      </div>
    </Link>
  );
}
