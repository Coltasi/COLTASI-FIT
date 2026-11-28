"use client";

import { useState } from "react";
import { addDays, daysBetween, fmtShort } from "@/lib/dates";

export type SleepNight = { night: string; hours: number };

const TARGET_H = 7;
// Same ranges and look as the body comp Trend and the Food deficit card. YTD runs from 1 January.
const RANGES = [{ k: "1w", l: "1W", days: 7 }, { k: "1m", l: "1M", days: 31 }, { k: "3m", l: "3M", days: 91 }, { k: "6m", l: "6M", days: 183 }, { k: "ytd", l: "YTD", days: null }, { k: "1y", l: "1Y", days: 365 }] as const;
type RangeKey = (typeof RANGES)[number]["k"];

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const good = (h: number | null) => h != null && h >= TARGET_H;

/**
 * Progress → Body: sleep over a chosen range. Up to 1M it's one bar per night; longer ranges show one bar
 * per week (that week's average) so the chart stays readable. Bars are green at 7 h or more, red under.
 */
export function SleepChart({ nights, lastNight }: { nights: SleepNight[]; lastNight: string }) {
  const [range, setRange] = useState<RangeKey>("1m");
  const r = RANGES.find((x) => x.k === range)!;
  const from = range === "ytd" ? `${lastNight.slice(0, 4)}-01-01` : addDays(lastNight, -((r.days ?? 365) - 1));
  const len = daysBetween(from, lastNight) + 1;
  const inRange = nights.filter((n) => n.night >= from && n.night <= lastNight);
  const prevFrom = addDays(from, -len);
  const prev = nights.filter((n) => n.night >= prevFrom && n.night < from);

  const a = avg(inRange.map((n) => n.hours));
  const aPrev = avg(prev.map((n) => n.hours));
  const hit = inRange.filter((n) => good(n.hours)).length;

  // Bars: nightly up to 1M, weekly averages beyond.
  const byNight = new Map(inRange.map((n) => [n.night, n.hours]));
  const weekly = len > 31;
  const bars: { key: string; h: number | null }[] = [];
  if (!weekly) {
    for (let i = 0; i < len; i++) { const d = addDays(from, i); bars.push({ key: d, h: byNight.get(d) ?? null }); }
  } else {
    for (let s = from; s <= lastNight; s = addDays(s, 7)) {
      const hs: number[] = [];
      for (let i = 0; i < 7; i++) { const v = byNight.get(addDays(s, i)); if (v != null && addDays(s, i) <= lastNight) hs.push(v); }
      bars.push({ key: s, h: avg(hs) });
    }
  }
  const maxH = Math.max(9, ...inRange.map((n) => n.hours)) * 1.08;

  return (
    <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 16 }}>
      <p className="sec">Sleep</p>

      <div role="group" aria-label="Time range" style={{ display: "grid", gridTemplateColumns: `repeat(${RANGES.length}, minmax(0,1fr))`, gap: 6 }}>
        {RANGES.map((x) => (
          <button key={x.k} type="button" aria-pressed={range === x.k} onClick={() => setRange(x.k)}
            className="pill" style={{ padding: 0, minWidth: 0, ...(range === x.k ? { background: "var(--rust)", borderColor: "var(--rust)", color: "#fff", fontWeight: 800 } : {}) }}>{x.l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="stat">
          <b style={{ color: a == null ? undefined : good(a) ? "var(--jade)" : "var(--crimson)" }}>{a == null ? "–" : `${a} h`}</b>
          <span>{aPrev == null ? "average" : `average, ${a != null && a >= aPrev ? "up" : "down"} from ${aPrev} h`}</span>
        </div>
        <div className="stat">
          <b>{inRange.length ? `${hit} of ${inRange.length}` : "–"}</b>
          <span>nights at {TARGET_H} h or more</span>
        </div>
      </div>

      {inRange.length ? (
        <div style={{ position: "relative", height: 88 }} role="img"
          aria-label={`Hours slept ${weekly ? "per week on average" : "per night"} since ${fmtShort(from)}, dashed line is ${TARGET_H} hours`}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(TARGET_H / maxH) * 100}%`, borderTop: "1.5px dashed var(--mist)" }} />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, minmax(0,1fr))`, gap: bars.length > 20 ? 3 : 6, alignItems: "end", height: "100%" }}>
            {bars.map((b) => (
              <div key={b.key} style={{ height: b.h ? `${Math.max(4, (b.h / maxH) * 100)}%` : 3, borderRadius: 3, background: b.h == null ? "var(--line-soft)" : good(b.h) ? "var(--jade)" : "var(--crimson)" }} />
            ))}
          </div>
        </div>
      ) : (
        <p className="cap">No sleep logged in this range.</p>
      )}
      <p className="cap">{fmtShort(from)} to {fmtShort(lastNight)}{weekly ? ", one bar per week" : ""}. Dashed line is {TARGET_H} hours.</p>
    </div>
  );
}
