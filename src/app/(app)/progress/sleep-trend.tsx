import Link from "next/link";
import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";

const NIGHTS = 28;
const TARGET_H = 7;

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const fmtH = (h: number | null) => (h == null ? "–" : `${h} h`);

/** Progress → Body: 4 weeks of sleep, with this week's and last week's averages. Bars are green at 7 h or more, red under. */
export async function SleepTrend({ supabase, today }: { supabase: Supa; today: string }) {
  const last = addDays(today, -1); // last night
  const from = addDays(last, -(NIGHTS - 1));
  const { data } = await supabase.from("sleep_logs").select("night_of, hours").gte("night_of", from).lte("night_of", last).order("night_of");
  const rows = ((data ?? []) as { night_of: string; hours: number | string | null }[])
    .filter((r) => r.hours != null).map((r) => ({ night: r.night_of, hours: Number(r.hours) }));

  if (!rows.length) {
    return (
      <div className="card" style={{ padding: "16px 18px" }}>
        <p className="sec">Sleep</p>
        <p className="cap" style={{ marginTop: 6 }}>Log your sleep to see your trend here.</p>
        <Link prefetch={false} href="/sleep" className="pill" style={{ marginTop: 12 }}>Log sleep</Link>
      </div>
    );
  }

  const byNight = new Map(rows.map((r) => [r.night, r.hours]));
  const nights = Array.from({ length: NIGHTS }, (_, i) => addDays(from, i));
  const week = rows.filter((r) => r.night > addDays(last, -7)).map((r) => r.hours);
  const prev = rows.filter((r) => r.night <= addDays(last, -7) && r.night > addDays(last, -14)).map((r) => r.hours);
  const a7 = avg(week), aPrev = avg(prev);
  const maxH = Math.max(9, ...rows.map((r) => r.hours)) * 1.08;
  const good = (h: number | null) => h != null && h >= TARGET_H;

  return (
    <Link prefetch={false} href="/sleep" className="card" style={{ padding: "16px 18px", display: "grid", gap: 16, color: "var(--navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="sec">Sleep</p>
        <p className="cap">4 weeks</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="stat">
          <b style={{ color: a7 == null ? undefined : good(a7) ? "var(--jade)" : "var(--crimson)" }}>{fmtH(a7)}</b>
          <span>avg last 7 nights</span>
        </div>
        <div className="stat">
          <b>{fmtH(aPrev)}</b>
          <span>avg week before</span>
        </div>
      </div>

      <div style={{ position: "relative", height: 72 }} role="img" aria-label={`Hours slept per night over the last 4 weeks, dashed line is ${TARGET_H} hours`}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(TARGET_H / maxH) * 100}%`, borderTop: "1.5px dashed var(--mist)" }} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${NIGHTS}, minmax(0,1fr))`, gap: 3, alignItems: "end", height: "100%" }}>
          {nights.map((n) => {
            const h = byNight.get(n);
            return <div key={n} style={{ height: h ? `${Math.max(4, (h / maxH) * 100)}%` : 3, borderRadius: 2, background: h == null ? "var(--line-soft)" : good(h) ? "var(--jade)" : "var(--crimson)" }} />;
          })}
        </div>
      </div>
      <p className="cap">Dashed line is {TARGET_H} hours. Green nights hit it, red ones didn&apos;t.</p>
    </Link>
  );
}
