import { BrandRow, CoachMark } from "@/components/ui";
import { PARTS, ReadText } from "@/components/coach-read-parts";
import { CoachPlan } from "@/components/coach-plan";
import { RefreshRead } from "./refresh-read";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { addDays, fmtDay } from "@/lib/dates";

import { signed, unit } from "@/lib/units";
import { weeklyRate } from "@/lib/coach";
import { fmtK, getSteps, stepSummary } from "@/lib/steps";
import { AskBox } from "./ask-box";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default async function CoachPage() {
  const { supabase, today, units, profile, tz } = await getContext();
  const programP = getProgram(supabase);
  const [, week, { data: reads }, { data: wis }, { data: sleeps }, stepRows] = await Promise.all([
    programP,
    getWeekState(supabase, today, programP),
    supabase.from("coach_reads").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(4),
    supabase.from("sleep_logs").select("hours").gte("night_of", addDays(today, -7)),
    getSteps(supabase, today, 14),
  ]);
  const stepAvg = stepSummary(stepRows, today).avg7;
  const rate = weeklyRate(((wis ?? []) as any[]).map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) })));
  const target = profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week);
  const behind = rate != null && target != null && (target < 0 ? rate > target * 0.75 : rate < target * 0.75);
  const sl = ((sleeps ?? []) as any[]).map((r) => Number(r.hours));
  const avgSleep = sl.length ? sl.reduce((a, b) => a + b) / sl.length : null;
  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const latest = ((reads ?? []) as any[])[0];
  const dayIso = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const dayFmt = (iso: string) => fmtDay(dayIso(iso));

  return (
    <main className="screen" style={{ paddingBottom: 260 }}>
      <BrandRow />
      <div>
        <h1 className="disp" style={{ fontSize: 30, lineHeight: 1 }}>Coach</h1>
        <p className="cap" style={{ marginTop: 6 }}>Ask anything, and see every read so far</p>
      </div>

      <AskBox />

      <div>
        <p className="lab" style={{ marginBottom: 8 }}>This week</p>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
          <div style={{ padding: 12 }}><div className="num" style={{ fontSize: 20 }}>{week.doneThisWeek}</div><p className="cap">Workouts</p></div>
          <div style={{ padding: 12, borderLeft: "1px solid var(--line-soft)" }}>
            <div className="num" style={{ fontSize: 20, color: behind ? "var(--rust)" : "var(--navy)" }}>{rate != null ? signed(conv(rate)) : "–"}<span style={{ fontSize: 13 }}> {unit(units)}</span></div>
            <p className="cap">{target != null ? `vs ${signed(conv(target), 2)} plan` : "per week"}</p>
          </div>
          <div style={{ padding: 12, borderLeft: "1px solid var(--line-soft)" }}><div className="num" style={{ fontSize: 20 }}>{avgSleep != null ? avgSleep.toFixed(1) : "–"}<span style={{ fontSize: 13, color: "var(--muted)" }}> h</span></div><p className="cap">Avg sleep</p></div>
          <div style={{ padding: 12, borderLeft: "1px solid var(--line-soft)" }}><div className="num" style={{ fontSize: 20 }}>{stepAvg != null ? fmtK(stepAvg) : "–"}</div><p className="cap">Avg steps</p></div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p className="lab">Reads</p>
          {latest ? <RefreshRead /> : null}
        </div>
        {reads?.length ? (
          <div className="card clip">
            {((reads ?? []) as any[]).map((r, i) => (
              <details key={r.id} className="row" style={{ display: "block", borderTop: i ? undefined : 0 }} open={i === 0}>
                <summary style={{ listStyle: "none", cursor: "pointer" }}>
                  <p className="cap" style={{ fontSize: 12, fontWeight: 600 }}>
                    {r.kind === "session" ? "After a session" : r.kind === "scan" ? "Body scan" : "Weigh-in"} · {i === 0 ? ago(r.created_at) : dayFmt(r.created_at)}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.45, marginTop: 2 }}>{r.headline}</p>
                </summary>
                {r.signals?.sleep && Array.isArray(r.signals.lifts) ? (
                  <div style={{ marginTop: 8 }}><CoachPlan s={r.signals} weight={r.weight} units={units} /></div>
                ) : PARTS.filter(([, k]) => r[k]).map(([l, k]) => (
                  <div key={k} style={{ marginTop: 8 }}><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{l}</p><ReadText text={r[k]} /></div>
                ))}
              </details>
            ))}
          </div>
        ) : (
          <div className="card cream" style={{ padding: 16, display: "flex", gap: 10 }}>
            <CoachMark />
            <p style={{ fontSize: 15, lineHeight: 1.45 }}>Finish a session or log a Monday weigh-in and your first read appears here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
