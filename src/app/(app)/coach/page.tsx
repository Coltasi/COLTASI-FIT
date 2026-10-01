import { BrandRow, CoachMark } from "@/components/ui";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { addDays, fmtDay } from "@/lib/dates";
import { signed, unit } from "@/lib/units";
import { weeklyRate } from "@/lib/coach";
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
  const [program, { data: reads }, { data: wis }, { data: sleeps }] = await Promise.all([
    getProgram(supabase),
    supabase.from("coach_reads").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(4),
    supabase.from("sleep_logs").select("hours").gte("night_of", addDays(today, -7)),
  ]);
  const week = await getWeekState(supabase, today, program);
  const split = program.filter((d) => d.program === "split");
  const rate = weeklyRate(((wis ?? []) as any[]).map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) })));
  const target = profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week);
  const behind = rate != null && target != null && (target < 0 ? rate > target * 0.75 : rate < target * 0.75);
  const sl = ((sleeps ?? []) as any[]).map((r) => Number(r.hours));
  const avgSleep = sl.length ? sl.reduce((a, b) => a + b) / sl.length : null;
  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const [latest, ...earlier] = (reads ?? []) as any[];
  const dayFmt = (iso: string) => fmtDay(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)));

  return (
    <main className="screen" style={{ paddingBottom: 260 }}>
      <BrandRow />
      <div>
        <h1 className="disp" style={{ fontSize: 30, lineHeight: 1 }}>Coach</h1>
        <p className="cap" style={{ marginTop: 6 }}>A read after every session and every Monday weigh-in</p>
      </div>

      {latest ? (
        <div className="card cream" style={{ padding: "16px 16px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}>
              <CoachMark />{latest.kind === "session" ? "After a session" : "Weigh-in"} · {dayFmt(latest.created_at)}
            </p>
            <p className="cap" style={{ fontSize: 12 }}>{ago(latest.created_at)}</p>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, margin: "8px 0 6px" }}>{latest.headline}</p>
          {[
            ["Lifting", latest.lifting, "var(--kingfisher)"],
            ["Weight & diet", latest.weight, "var(--ember)"],
            ["Recovery", latest.recovery, "var(--lagoon)"],
          ].filter(([, t]) => t).map(([l, t, c]) => (
            <div key={l} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 10, padding: "12px 0", borderTop: "1px solid #e6dcc0" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", marginTop: 5, background: c }} />
              <div><p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{l}</p><p style={{ fontSize: 14, lineHeight: 1.45 }}>{t}</p></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card cream" style={{ padding: 16, display: "flex", gap: 10 }}>
          <CoachMark />
          <p style={{ fontSize: 15, lineHeight: 1.45 }}>Finish a session or log a Monday weigh-in and your first read appears here.</p>
        </div>
      )}

      <div>
        <p className="lab" style={{ marginBottom: 8 }}>This week</p>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
          <div style={{ padding: 12 }}><div className="num" style={{ fontSize: 20 }}>{split.filter((d) => week.done.has(d.id)).length}<span style={{ fontSize: 13, color: "var(--muted)" }}> / {split.length}</span></div><p className="cap">Split days</p></div>
          <div style={{ padding: 12, borderLeft: "1px solid var(--line-soft)" }}>
            <div className="num" style={{ fontSize: 20, color: behind ? "var(--rust)" : "var(--navy)" }}>{rate != null ? signed(conv(rate)) : "–"}<span style={{ fontSize: 13 }}> {unit(units)}</span></div>
            <p className="cap">{target != null ? `vs ${signed(conv(target), 2)} plan` : "per week"}</p>
          </div>
          <div style={{ padding: 12, borderLeft: "1px solid var(--line-soft)" }}><div className="num" style={{ fontSize: 20 }}>{avgSleep != null ? avgSleep.toFixed(1) : "–"}<span style={{ fontSize: 13, color: "var(--muted)" }}> h</span></div><p className="cap">Avg sleep</p></div>
        </div>
      </div>

      {earlier.length ? (
        <div className="card clip">
          <div style={{ padding: "12px 16px 8px" }}><p className="lab">Earlier reads</p></div>
          {earlier.map((r) => (
            <details key={r.id} className="row" style={{ display: "block" }}>
              <summary style={{ listStyle: "none", cursor: "pointer" }}>
                <p style={{ fontSize: 15, fontWeight: 600 }}>
                  {r.kind === "session" ? "Session" : "Weigh-in"} · {dayFmt(r.created_at)}{" "}
                  <span className={`tag ${r.kind === "session" ? "blue" : "ember"}`} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", verticalAlign: 2 }}>{r.kind === "session" ? "Session" : "Weigh-in"}</span>
                </p>
                <p className="cap">{r.headline}</p>
              </summary>
              {[r.lifting, r.weight, r.recovery].filter(Boolean).map((t: string, i: number) => <p key={i} style={{ fontSize: 14, lineHeight: 1.45, marginTop: 8 }}>{t}</p>)}
            </details>
          ))}
        </div>
      ) : null}

      <AskBox />
    </main>
  );
}
