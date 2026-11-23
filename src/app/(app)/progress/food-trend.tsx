import Link from "next/link";
import type { Supa } from "@/lib/data";
import { addDays, fmtShort, mondayOf } from "@/lib/dates";
import { dayTotals } from "@/lib/energy";
import { signed, unit, type Units } from "@/lib/units";

const DAYS = 28;

/** Progress → Body: 4 weeks of calories against target, protein hit rate, and each week's food next to its weight change. */
export async function FoodTrend({ supabase, today, targetKcal, targetProtein, weights, units }: {
  supabase: Supa; today: string; targetKcal: number | null; targetProtein: number | null;
  weights: { d: string; kg: number }[]; units: Units;
}) {
  const from = addDays(today, -(DAYS - 1));
  const { data } = await supabase.from("food_logs").select("day, kcal, protein_g").gte("day", from).lte("day", today);
  const totals = new Map(dayTotals((data ?? []) as { day: string; kcal: number; protein_g: number }[]).map((d) => [d.day, d]));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const logged = days.filter((d) => totals.has(d) && d !== today);

  if (!totals.size) {
    return (
      <div className="card" style={{ padding: "14px 16px" }}>
        <p className="lab">Food</p>
        <p className="cap" style={{ marginTop: 6, fontSize: 13 }}>Nothing logged yet. Once you log in the <Link href="/food">Food tab</Link>, your calories and protein show up here next to your weight.</p>
      </div>
    );
  }

  const avgK = logged.length ? Math.round(logged.reduce((s, d) => s + totals.get(d)!.kcal, 0) / logged.length) : null;
  const avgP = logged.length ? Math.round(logged.reduce((s, d) => s + totals.get(d)!.protein, 0) / logged.length) : null;
  const hitP = targetProtein ? logged.filter((d) => totals.get(d)!.protein >= targetProtein * 0.95).length : null;
  const maxK = Math.max(targetKcal ?? 0, ...[...totals.values()].map((t) => t.kcal)) * 1.05 || 3000;

  // Weekly rows, newest first: average food on logged days and the weight change across that week.
  const weightAt = (d: string) => {
    let best: { d: string; kg: number } | null = null;
    for (const p of weights) if (p.d <= d) best = p;
    return best;
  };
  const weeks: { start: string; avgK: number | null; avgP: number | null; n: number; change: number | null }[] = [];
  for (let m = mondayOf(today); m >= mondayOf(from); m = addDays(m, -7)) {
    const ds = Array.from({ length: 7 }, (_, i) => addDays(m, i)).filter((d) => d >= from && d < today && totals.has(d));
    const startW = weightAt(addDays(m, -1)) ?? weights.find((p) => p.d >= m) ?? null;
    const endW = weightAt(addDays(m, 6) < today ? addDays(m, 6) : today);
    weeks.push({
      start: m,
      n: ds.length,
      avgK: ds.length ? Math.round(ds.reduce((s, d) => s + totals.get(d)!.kcal, 0) / ds.length) : null,
      avgP: ds.length ? Math.round(ds.reduce((s, d) => s + totals.get(d)!.protein, 0) / ds.length) : null,
      change: startW && endW && endW.d > startW.d ? endW.kg - startW.kg : null,
    });
  }
  const toU = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);

  return (
    <div className="card" style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="lab">Food · last 4 weeks</p>
        <Link href="/food" style={{ fontSize: 13, fontWeight: 600 }}>Food tab</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
        <div><p className="cap" style={{ fontSize: 12 }}>Avg calories</p><p className="num" style={{ fontSize: 20 }}>{avgK?.toLocaleString("en-US") ?? "–"}</p></div>
        <div><p className="cap" style={{ fontSize: 12 }}>Avg protein</p><p className="num" style={{ fontSize: 20 }}>{avgP != null ? `${avgP} g` : "–"}</p></div>
        <div><p className="cap" style={{ fontSize: 12 }}>Protein hit</p><p className="num" style={{ fontSize: 20 }}>{hitP != null ? `${hitP}/${logged.length}` : "–"}</p></div>
      </div>

      <div style={{ position: "relative", height: 90 }} role="img" aria-label="Calories per day over the last 4 weeks against your target">
        {targetKcal ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(targetKcal / maxK) * 100}%`, borderTop: "1.5px dashed var(--navy)", opacity: 0.5 }} />
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${DAYS}, minmax(0,1fr))`, gap: 2, alignItems: "end", height: "100%" }}>
          {days.map((d) => {
            const t = totals.get(d);
            const over = t && targetKcal && t.kcal > targetKcal;
            return <div key={d} style={{ height: t ? `${Math.max(4, (t.kcal / maxK) * 100)}%` : "4%", borderRadius: 2, background: !t ? "var(--line-soft)" : d === today ? "#BFE0EC" : over ? "var(--ember)" : "var(--kingfisher)" }} />;
          })}
        </div>
      </div>
      <p className="cap" style={{ fontSize: 12, marginTop: -6 }}>
        Dashed line = your target{targetKcal ? ` (${targetKcal.toLocaleString("en-US")})` : ""}. Orange = over. Gray = not logged. Today counts once it&apos;s over.
      </p>

      <div style={{ borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.8fr 1fr", gap: 6, padding: "8px 0 4px" }} className="cap">
          <span style={{ fontSize: 11 }}>Week of</span><span style={{ fontSize: 11 }}>Avg kcal</span><span style={{ fontSize: 11 }}>Protein</span><span style={{ fontSize: 11, textAlign: "right" }}>Weight</span>
        </div>
        {weeks.map((wk) => (
          <div key={wk.start} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.8fr 1fr", gap: 6, padding: "6px 0", borderTop: "1px solid var(--line-soft)", fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{fmtShort(wk.start)}</span>
            <span className="num" style={{ color: wk.avgK && targetKcal && wk.avgK > targetKcal ? "var(--rust)" : undefined }}>{wk.avgK?.toLocaleString("en-US") ?? "–"}{wk.n && wk.n < 5 ? <span className="cap" style={{ fontSize: 11 }}> ({wk.n}d)</span> : null}</span>
            <span className="num">{wk.avgP != null ? `${wk.avgP} g` : "–"}</span>
            <span className="num" style={{ textAlign: "right", color: wk.change != null && wk.change < 0 ? "var(--kingfisher-text)" : undefined }}>
              {wk.change != null ? `${signed(toU(wk.change))} ${unit(units)}` : "–"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
