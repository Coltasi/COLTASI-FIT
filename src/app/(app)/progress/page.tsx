import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { IconDoc } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, daysBetween, fmtDay, fmtMonth, fmtShort, mondayOf } from "@/lib/dates";
import { signed, unit, w } from "@/lib/units";
import { weeklyRate } from "@/lib/coach";
import { LineChart, ProgressTabs } from "./parts";
import { WeighInForm } from "./weigh-in-form";

export default async function ProgressBodyPage() {
  const { supabase, today, units, profile } = await getContext();
  const since = addDays(today, -200);
  const [{ data: wiRows }, { data: scanRows }] = await Promise.all([
    supabase.from("weigh_ins").select("measured_on, weight_kg").gte("measured_on", since).order("measured_on"),
    supabase.from("scans").select("id, scanned_on, weight_kg, body_fat_pct, muscle_mass_kg, water_pct").order("scanned_on", { ascending: false }).limit(40),
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
  const rate = weeklyRate(weighIns.slice(-4));

  const monday = mondayOf(today);
  const thisWeek = weighIns.find((p) => p.measured_on >= monday);
  const nextMonday = addDays(monday, 7);
  const due = !thisWeek;

  const x0 = first?.d ?? today;
  const scanSet = new Set(scans.map((s) => s.scanned_on));
  const months = [...new Set(series.map((p) => fmtMonth(p.d)))];

  const [s0, s1] = scans;
  const delta = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? Number(a) - Number(b) : null);
  const comp = [
    { l: "Body fat", v: s0?.body_fat_pct, u: "%", d: delta(s0?.body_fat_pct, s1?.body_fat_pct), goodDown: true },
    { l: "Muscle", v: s0?.muscle_mass_kg == null ? null : w(s0.muscle_mass_kg, units), u: ` ${unit(units)}`, d: delta(s0?.muscle_mass_kg, s1?.muscle_mass_kg), goodDown: false },
    { l: "Water", v: s0?.water_pct, u: "%", d: delta(s0?.water_pct, s1?.water_pct), goodDown: null },
  ];

  return (
    <main className="screen">
      <BrandRow />
      <h1 className="disp" style={{ fontSize: 30 }}>Progress</h1>
      <ProgressTabs active="body" />

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
        label={due ? (daysBetween(monday, today) === 0 ? "due today" : "due this week") : `logged ${fmtDay(thisWeek!.measured_on)} · next ${fmtShort(nextMonday)}`}
      />

      {series.length > 1 ? (
        <div className="card" style={{ padding: "16px 16px 12px" }}>
          <div className="cap" style={{ display: "flex", gap: 14, marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9FCBDF" }} />Weigh-in</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--kingfisher)" }} />Tanita scan</span>
          </div>
          <LineChart
            ariaLabel={`Weight from ${w(first!.kg, units)} to ${w(latest!.kg, units)} ${unit(units)}`}
            unitLabel={unit(units)}
            points={series.map((p) => ({ x: daysBetween(x0, p.d), y: Number(w(p.kg, units)) }))}
            markers={series.map((p) => ({ x: daysBetween(x0, p.d), y: Number(w(p.kg, units)), kind: p.src === "scan" || scanSet.has(p.d) ? "big" as const : "small" as const }))}
            xLabels={months}
          />
        </div>
      ) : null}

      {s0 ? (
        <div>
          <p className="lab" style={{ marginBottom: 8 }}>Composition{s1 ? ` · vs ${fmtShort(s1.scanned_on)}` : ""}</p>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            {comp.map((c, i) => (
              <div key={c.l} style={{ padding: "14px 12px", borderLeft: i ? "1px solid var(--line-soft)" : undefined }}>
                <div className="num" style={{ fontSize: 22 }}>{c.v ?? "–"}<span style={{ fontSize: 14 }}>{c.v != null ? c.u : ""}</span></div>
                <p className="cap">{c.l}</p>
                {c.d != null ? (
                  <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: c.goodDown == null ? "var(--muted)" : (c.d < 0) === c.goodDown ? "var(--kingfisher-text)" : "var(--rust)" }}>
                    {c.d < 0 ? "▼" : c.d > 0 ? "▲" : "±"} {Math.abs(Math.round(c.d * 10) / 10)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
