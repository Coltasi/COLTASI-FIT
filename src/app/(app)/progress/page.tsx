import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { getContext } from "@/lib/data";
import { addDays, daysBetween, fmtDay, fmtShort, mondayOf } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { ProgressTabs } from "./parts";
import { BodyCompChart, type CompPoint, type MetricKey } from "./body-comp-chart";
import { WeighInForm } from "./weigh-in-form";
import { SessionCounts } from "./session-counts";
import { FoodTrend } from "./food-trend";
import { StepsTrend } from "./steps-trend";

export default async function ProgressBodyPage() {
  const { supabase, today, units, profile } = await getContext();
  const since = addDays(today, -1100);
  const [{ data: wiRows }, { data: scanRows }] = await Promise.all([
    supabase.from("weigh_ins").select("measured_on, weight_kg").gte("measured_on", since).order("measured_on"),
    supabase.from("scans").select("id, scanned_on, weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, water_pct").order("scanned_on", { ascending: false }).limit(40),
  ]);
  const weighIns = ((wiRows ?? []) as any[]).map((r) => ({ measured_on: r.measured_on as string, weight_kg: Number(r.weight_kg) }));
  const scans = ((scanRows ?? []) as any[]).map((r) => ({ ...r, weight_kg: r.weight_kg == null ? null : Number(r.weight_kg) }));

  // Headline weight: latest of weigh-ins and scans.
  const series = [
    ...weighIns.map((p) => ({ d: p.measured_on, kg: p.weight_kg, src: "weigh-in" })),
    ...scans.filter((s) => s.weight_kg != null).map((s) => ({ d: s.scanned_on, kg: s.weight_kg as number, src: "scan" })),
  ].sort((a, b) => (a.d < b.d ? -1 : 1));
  const latest = series.at(-1);

  // Weigh-in days are Mon, Wed and Fri.
  const monday = mondayOf(today);
  const WEIGH_DAYS = [0, 2, 4];
  const dowToday = daysBetween(monday, today);
  const loggedToday = weighIns.find((p) => p.measured_on === today);
  const nextIdx = WEIGH_DAYS.find((d) => d > dowToday);
  const nextWeigh = nextIdx != null ? addDays(monday, nextIdx) : addDays(monday, 7);
  const due = WEIGH_DAYS.includes(dowToday) && !loggedToday;
  const nextLabelDay = loggedToday || !WEIGH_DAYS.includes(dowToday) ? nextWeigh : today;

  // Overlay series, all as mass in kg so they share one axis.
  const num = (v: unknown) => (v == null ? null : Number(v));
  const asc = [...scans].reverse();
  const scanSet = new Set(scans.map((s) => s.scanned_on as string));
  const scanSeries = (pick: (s: (typeof scans)[number]) => number | null): CompPoint[] =>
    asc.map((s) => ({ d: s.scanned_on as string, kg: pick(s), src: "scan" as CompPoint["src"] }))
      .filter((p): p is CompPoint => p.kg != null && !Number.isNaN(p.kg));
  const compSeries: Record<MetricKey, CompPoint[]> = {
    weight: series
      .filter((p) => p.src === "scan" || !scanSet.has(p.d))
      .map((p) => ({ d: p.d, kg: p.kg, src: p.src as CompPoint["src"] })),
    muscle: scanSeries((s) => num(s.muscle_mass_kg)),
    water: scanSeries((s) => (s.water_pct != null && s.weight_kg != null ? (Number(s.water_pct) * s.weight_kg) / 100 : null)),
    fat: scanSeries((s) => num(s.fat_mass_kg) ?? (s.body_fat_pct != null && s.weight_kg != null ? (Number(s.body_fat_pct) * s.weight_kg) / 100 : null)),
  };

  return (
    <main className="screen">
      <BrandRow />
      <h1 className="disp" style={{ fontSize: 30 }}>Progress</h1>
      <ProgressTabs active="body" />
      <WeighInForm
        units={units}
        today={today}
        placeholder={latest ? w(latest.kg, units) : units === "imperial" ? "lb" : "kg"}
        due={due}
        label={due ? "Due today" : `Next: ${fmtDay(nextLabelDay)}`}
      />

      {series.length > 1 ? <BodyCompChart series={compSeries} units={units} /> : null}

      <SessionCounts supabase={supabase} today={today} />

      <StepsTrend supabase={supabase} today={today} />

      <FoodTrend supabase={supabase} today={today} targetKcal={profile.target_kcal ?? null} targetProtein={profile.protein_g ?? null} />

      <details className="card clip scans">
        <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", cursor: "pointer", listStyle: "none" }}>
          <span className="sec">Tanita scans <span className="cap" style={{ fontSize: 15, fontWeight: 600 }}>{scans.length}</span></span>
          <span aria-hidden className="chev" style={{ color: "var(--muted)", fontSize: 18, transition: "transform .15s" }}>⌄</span>
        </summary>
        {scans.length ? (
          <div style={{ padding: "0 18px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
              <span>Date</span><span style={{ textAlign: "right" }}>Body fat</span><span style={{ textAlign: "right" }}>Muscle</span><span style={{ textAlign: "right" }}>Weight</span>
            </div>
            {scans.map((s) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 15, color: "var(--navy)" }}>
                <span style={{ fontWeight: 600 }}>{fmtShort(s.scanned_on)}</span>
                <span className="num" style={{ textAlign: "right" }}>{s.body_fat_pct != null ? `${s.body_fat_pct}%` : "–"}</span>
                <span className="num" style={{ textAlign: "right" }}>{s.muscle_mass_kg != null ? w(s.muscle_mass_kg, units) : "–"}</span>
                <span className="num" style={{ textAlign: "right" }}>{s.weight_kg != null ? w(s.weight_kg, units) : "–"}</span>
              </div>
            ))}
            <p className="cap" style={{ padding: "8px 0 4px", fontSize: 14 }}>Muscle and weight in {unit(units)}</p>
          </div>
        ) : <p className="cap" style={{ padding: "0 18px 12px", fontSize: 14 }}>No scans yet.</p>}
        <div style={{ padding: "4px 18px 16px" }}>
          <Link href="/progress/scan" className="btn2" style={{ width: "100%", height: 44, fontSize: 14 }}>+ Add scan</Link>
        </div>
      </details>
    </main>
  );
}
