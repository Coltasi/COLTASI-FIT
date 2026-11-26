import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { addDays, daysBetween, fmtDay, fmtShort, mondayOf } from "@/lib/dates";
import { signed, unit, w } from "@/lib/units";
import { ProgressTabs } from "./parts";
import { BodyCompChart, type CompPoint, type MetricKey } from "./body-comp-chart";
import { WeighInForm } from "./weigh-in-form";
import { SessionCounts } from "./session-counts";
import { FoodTrend } from "./food-trend";
import { StepsTrend } from "./steps-trend";
import type { Num, WeighRow } from "@/lib/rows";
import { onPace, trendRate } from "@/lib/coach";

export default async function ProgressBodyPage() {
  const { supabase, today, units, profile } = await getContext();
  const since = addDays(today, -1100);
  const [{ data: wiRows }, { data: scanRows }] = await Promise.all([
    supabase.from("weigh_ins").select("measured_on, weight_kg").gte("measured_on", since).order("measured_on"),
    supabase.from("scans").select("id, scanned_on, weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, water_pct").order("scanned_on", { ascending: false }).limit(40),
  ]);
  const weighIns = ((wiRows ?? []) as WeighRow[]).map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) }));
  const scans = ((scanRows ?? []) as ({ id: string; scanned_on: string; weight_kg: Num | null; body_fat_pct: number | null; fat_mass_kg: number | null; muscle_mass_kg: number | null; water_pct: number | null })[]).map((r) => ({ ...r, weight_kg: r.weight_kg == null ? null : Number(r.weight_kg) }));

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

  // Body comp series: each scan point as a mass (kg) and as a % of that scan's body weight,
  // whichever the Tanita stored, with the other worked out from the weight.
  const num = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const asc = [...scans].reverse();
  const scanSet = new Set(scans.map((s) => s.scanned_on as string));
  type Scan = (typeof scans)[number];
  const ofWeight = (s: Scan, kg: number | null, pct: number | null) => ({
    kg: kg ?? (pct != null && s.weight_kg != null ? (pct * s.weight_kg) / 100 : null),
    pct: pct ?? (kg != null && s.weight_kg ? (kg / s.weight_kg) * 100 : null),
  });
  const scanSeries = (pick: (s: Scan) => { kg: number | null; pct: number | null }): CompPoint[] =>
    asc.map((s) => ({ d: s.scanned_on as string, ...pick(s), src: "scan" as const }))
      .filter((p) => p.kg != null || p.pct != null);
  const compSeries: Record<MetricKey, CompPoint[]> = {
    weight: series
      .filter((p) => p.src === "scan" || !scanSet.has(p.d))
      .map((p) => ({ d: p.d, kg: p.kg, pct: null, src: p.src as CompPoint["src"] })),
    muscle: scanSeries((s) => ofWeight(s, num(s.muscle_mass_kg), null)),
    water: scanSeries((s) => ofWeight(s, null, num(s.water_pct))),
    fat: scanSeries((s) => ofWeight(s, num(s.fat_mass_kg), num(s.body_fat_pct))),
  };

  // Hero: where weight is, how far it has come, and the recent rate against the target rate.
  const firstPt = series[0];
  const rate = trendRate(series.map((p) => ({ measured_on: p.d, weight_kg: p.kg })), today);
  const target = profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week);
  const phase = profile.phase ? profile.phase[0].toUpperCase() + profile.phase.slice(1) : null;
  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const total = latest && firstPt && latest.d !== firstPt.d ? conv(latest.kg) - conv(firstPt.kg) : null;
  // Binary progress colour: green when moving the right way at (or above) roughly target pace, red otherwise.
  const goingRight = (v: number | null) => (v == null || target == null || target === 0 ? null : Math.sign(v) === Math.sign(target));
  const paced = onPace(rate, target);
  const GOOD = "#4fc59f", BAD = "#f08a7a";
  const totalGood = goingRight(total);

  return (
    <main className="screen" style={{ gap: 22 }}>
      <PageHeader title="Progress" sub={phase ? `Current phase: ${phase}` : undefined} />
      <ProgressTabs active="body" />

      {latest ? (
        <section className="feature" aria-label="Weight">
          <p className="eyebrow">Current weight</p>
          <p className="feature-title" style={{ fontSize: 40 }}>{w(latest.kg, units)} {unit(units)}</p>
          {total != null ? <p style={{ fontSize: 17 }}><b style={{ color: totalGood == null ? undefined : totalGood ? GOOD : BAD }}>{signed(total)} {unit(units)}</b> since {fmtDay(firstPt.d)}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
            <div style={{ background: paced == null ? "var(--navy-2)" : paced ? "var(--jade)" : "var(--crimson)", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 15, color: paced == null ? "var(--on-navy-muted)" : "#fff" }}>Recent rate</p>
              <p className="num" style={{ fontSize: 20 }}>{rate != null ? `${signed(conv(rate))} ${unit(units)}/wk` : "Need more weigh-ins"}</p>
            </div>
            <div style={{ background: "var(--navy-2)", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 15, color: "var(--on-navy-muted)" }}>Target rate</p>
              <p className="num" style={{ fontSize: 20 }}>{target != null ? `${signed(conv(target))} ${unit(units)}/wk` : "Not set"}</p>
            </div>
          </div>
          {paced != null ? (
            <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: paced ? GOOD : BAD }}>
              <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: paced ? GOOD : BAD, color: "var(--navy)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{paced ? <path d="m5 12 5 5 9-10" /> : <path d="M12 7v6M12 17h.01" />}</svg>
              </span>
              {!paced
                ? (Math.sign(rate!) !== Math.sign(target!) ? "Moving the wrong way over the last six weeks." : "Behind your target over the last six weeks.")
                : Math.abs(rate!) > Math.abs(target!) * 1.3 ? "Ahead of your target over the last six weeks." : "On pace with your target over the last six weeks."}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="card" style={{ padding: 18 }}>
          <p className="ln">No weight logged yet</p>
          <p className="cap" style={{ marginTop: 4 }}>Log a weigh-in below. Your trend appears after a couple of weeks of Mon, Wed and Fri weigh-ins.</p>
        </section>
      )}
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

      <details className="card clip scans" style={{ marginTop: 4 }}>
        <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", cursor: "pointer", listStyle: "none" }}>
          <span><span className="sec" style={{ display: "block" }}>Tanita scan history</span><span className="cap">{scans.length} scans · bioimpedance estimates</span></span>
          <svg className="chev" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ember-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        {scans.length ? (
          <div style={{ padding: "0 18px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 15, fontWeight: 600, color: "var(--muted)" }}>
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
            <p className="cap" style={{ padding: "8px 0 4px" }}>Muscle and weight in {unit(units)}</p>
          </div>
        ) : <p className="cap" style={{ padding: "0 18px 12px", fontSize: 15 }}>No scans yet.</p>}
        <div style={{ padding: "4px 18px 16px" }}>
          <Link prefetch={false} href="/progress/scan" className="btn2" style={{ width: "100%" }}>+ Add scan</Link>
        </div>
      </details>
    </main>
  );
}
