import Link from "next/link";
import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { fmtSteps, getSteps, stepSummary } from "@/lib/steps";

const DAYS = 28;

/** Progress → Body: 4 weeks of daily steps, with this week's and last week's averages. */
export async function StepsTrend({ supabase, today }: { supabase: Supa; today: string }) {
  const rows = await getSteps(supabase, today, DAYS);
  const byDay = new Map(rows.map((r) => [r.day, r.steps]));
  const from = addDays(today, -(DAYS - 1));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));

  if (!rows.length) {
    return (
      <div className="card" style={{ padding: "16px 18px" }}>
        <p className="sec">Steps</p>
        <p className="cap" style={{ marginTop: 6 }}>Log steps on <Link href="/">Today</Link> to see your trend here.</p>
      </div>
    );
  }

  const s = stepSummary(rows, today);
  const maxS = Math.max(10000, ...rows.map((r) => r.steps)) * 1.08;

  return (
    <Link href="/steps" className="card" style={{ padding: "16px 18px", display: "grid", gap: 16, color: "var(--navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="sec">Steps</p>
        <p className="cap">4 weeks</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="stat">
          <b>{s.avg7 != null ? fmtSteps(s.avg7) : "–"}</b>
          <span>avg last 7 days</span>
        </div>
        <div className="stat">
          <b>{s.avgPrev7 != null ? fmtSteps(s.avgPrev7) : "–"}</b>
          <span>avg week before</span>
        </div>
      </div>

      <div style={{ position: "relative", height: 72 }} role="img" aria-label="Steps per day over the last 4 weeks, dashed line is 10,000">
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(10000 / maxS) * 100}%`, borderTop: "1.5px dashed var(--mist)" }} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${DAYS}, minmax(0,1fr))`, gap: 3, alignItems: "end", height: "100%" }}>
          {days.map((d) => {
            const v = byDay.get(d);
            return <div key={d} style={{ height: v ? `${Math.max(4, (v / maxS) * 100)}%` : 3, borderRadius: 2, background: v ? "var(--lagoon)" : "var(--line-soft)", opacity: d === today ? 0.4 : 1 }} />;
          })}
        </div>
      </div>
    </Link>
  );
}
