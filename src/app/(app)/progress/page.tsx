import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { IconDoc } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, daysBetween, fmtDay, fmtShort, mondayOf } from "@/lib/dates";
import { signed, unit, w } from "@/lib/units";
import { weeklyRate } from "@/lib/coach";
import { ProgressTabs } from "./parts";
import { BodyCompChart, type CompPoint, type MetricKey } from "./body-comp-chart";
import { WeighInForm } from "./weigh-in-form";
import { SessionCounts } from "./session-counts";
import { SleepVsLifts } from "./sleep-vs-lifts";
import { FoodTrend } from "./food-trend";

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
  const first = series[0];
  const rate = weeklyRate(weighIns.slice(-9));

  // Weigh-in days are Mon, Wed and Fri.
  const monday = mondayOf(today);
  const WEIGH_DAYS = [0, 2, 4];
  const dowToday = daysBetween(monday, today);
  const loggedToday = weighIns.find((p) => p.measured_on === today);
  const lastWeigh = weighIns.at(-1);
  const nextIdx = WEIGH_DAYS.find((d) => d > dowToday);
  const nextWeigh = nextIdx != null ? addDays(monday, nextIdx) : addDays(monday, 7);
  const due = WEIGH_DAYS.includes(dowToday) && !loggedToday;

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
      <SessionCounts supabase={supabase} today={today} />

      {latest ? (
        <div>
          <p className="lab">Weight · {latest.src} {fmtShort(latest.d)}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span className="disp" style={{ fontSize: 52, lineHeight: 1 }}>{w(latest.kg, units)}</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--muted)" }}>{unit(units)}</span>
          </div>
          <p className="cap" style={{ marginTop: 6 }}>
            {first && first.d !== latest.d ? (
              <><span style={{ color: "var(--kingfisher-text)", fontWeight: 700 }}>{latest.kg <= first.kg ? "▼" : "▲"} {w(Math.abs(latest.kg - first.kg), units)} {unit(units)}</span> since {fmtShort(first.d)}</>
            ) : "First entry. The trend starts next week."}
            {rate != null ? <> · <span style={{ color: "var(--navy)", fontWeight: 600 }}>{signed(units === "imperial" ? rate * 2.20462 : rate)} {unit(units)}/week</span> lately</> : null}
          </p>
        </div>
      ) : (
        <div>
          <p className="lab">Weight</p>
          <p className="cap" style={{ marginTop: 6 }}>Log your first weigh-in below to start the trend.</p>
        </div>
      )}

      <WeighInForm
        units={units}
        today={today}
        placeholder={latest ? w(latest.kg, units) : units === "imperial" ? "lb" : "kg"}
        due={due}
        label={due ? "due today" : `${lastWeigh ? `last ${fmtDay(lastWeigh.measured_on)} · ` : ""}next ${fmtDay(loggedToday || !WEIGH_DAYS.includes(dowToday) ? nextWeigh : today)}`}
      />

      {series.length > 1 ? <BodyCompChart series={compSeries} units={units} /> : null}

      <FoodTrend supabase={supabase} today={today} units={units} targetKcal={profile.target_kcal ?? null} targetProtein={profile.protein_g ?? null}
        weights={series.map((p) => ({ d: p.d, kg: p.kg }))} />

      <SleepVsLifts supabase={supabase} />

      <div className="card clip">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
          <p className="lab">Tanita scans</p>
          <Link href="/progress/scan" className="btn2" style={{ height: 36 }}>+ Add scan</Link>
        </div>
        {scans.map((s) => (
          <div key={s.id} className="row">
            <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--tint-neutral)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--stone)", flexShrink: 0 }}><IconDoc /></span>
            <div style={{ flexGrow: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{fmtShort(s.scanned_on)}</p>
              <p className="cap">{[s.body_fat_pct != null ? `${s.body_fat_pct}% fat` : null, s.muscle_mass_kg != null ? `${w(s.muscle_mass_kg, units)} ${unit(units)} muscle` : null].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="num" style={{ fontSize: 16 }}>{s.weight_kg != null ? w(s.weight_kg, units) : ""}</span>
          </div>
        ))}
        {!scans.length ? <p className="cap" style={{ padding: "0 16px 14px" }}>No scans yet.</p> : null}
      </div>
      {profile.target_rate_kg_week == null ? (
        <p className="cap">Set your target rate in <Link href="/settings">Settings</Link> so Coach can tell you if you&apos;re on pace.</p>
      ) : null}
    </main>
  );
}
