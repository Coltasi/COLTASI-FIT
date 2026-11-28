"use client";

import { useEffect, useState } from "react";
import { addDays, daysBetween, fmtShort } from "@/lib/dates";

/** One logged day. `target` is that day's goal (food: calories, which is maintenance on a break day). */
export type HabitDay = { day: string; value: number; target?: number | null; protein?: number };
export type HabitKey = "sleep" | "steps" | "food";

const RANGES = [{ k: "1w", l: "1W", days: 7 }, { k: "1m", l: "1M", days: 31 }, { k: "3m", l: "3M", days: 91 }, { k: "6m", l: "6M", days: 183 }, { k: "ytd", l: "YTD", days: null }, { k: "1y", l: "1Y", days: 365 }] as const;
type RangeKey = (typeof RANGES)[number]["k"];
const TABS: { k: HabitKey; l: string }[] = [{ k: "sleep", l: "Sleep" }, { k: "steps", l: "Steps" }, { k: "food", l: "Food" }];
const STORE_KEY = "coltasi.habits.tab";
const SLEEP_H = 7, STEPS = 10000;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const h1 = (v: number) => `${Math.round(v * 10) / 10} h`;

/** Whether a day hit its goal: sleep 7 h+, steps 10,000+, food at or under that day's calorie target. */
function hit(k: HabitKey, d: { value: number; target?: number | null }): boolean | null {
  if (k === "sleep") return d.value >= SLEEP_H;
  if (k === "steps") return d.value >= STEPS;
  return d.target ? d.value <= d.target * 1.05 : null;
}

/**
 * Progress → Body: one chart for sleep, steps and food, with the same 1W–1Y ranges as the body comp Trend.
 * Up to 1M it's one bar per day; longer ranges show weekly averages so the bars stay readable.
 * Green bars hit the goal, red ones didn't. Today is left out (steps and food are still filling in).
 */
export function HabitsChart({ data, lastDay, kcalTarget, proteinTarget }: {
  data: Record<HabitKey, HabitDay[]>; lastDay: string; kcalTarget: number | null; proteinTarget: number | null;
}) {
  const [tab, setTab] = useState<HabitKey>("sleep");
  const [range, setRange] = useState<RangeKey>("1m");
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-device preference after hydration
      if (s === "sleep" || s === "steps" || s === "food") setTab(s);
    } catch { /* storage unavailable */ }
  }, []);
  const pickTab = (k: HabitKey) => { setTab(k); try { localStorage.setItem(STORE_KEY, k); } catch { /* ignore */ } };

  const r = RANGES.find((x) => x.k === range)!;
  const from = range === "ytd" ? `${lastDay.slice(0, 4)}-01-01` : addDays(lastDay, -((r.days ?? 365) - 1));
  const len = daysBetween(from, lastDay) + 1;
  const all = data[tab];
  const rows = all.filter((d) => d.day >= from && d.day <= lastDay);
  const prev = all.filter((d) => d.day >= addDays(from, -len) && d.day < from);
  const avg = mean(rows.map((d) => d.value));
  const avgPrev = mean(prev.map((d) => d.value));
  const scored = rows.map((d) => hit(tab, d)).filter((x): x is boolean => x != null);
  const hits = scored.filter(Boolean).length;

  // Bars: daily up to 1M, weekly averages beyond. A weekly bar is green when most of its days hit.
  const byDay = new Map(rows.map((d) => [d.day, d]));
  const weekly = len > 31;
  const bars: { key: string; v: number | null; ok: boolean | null }[] = [];
  if (!weekly) {
    for (let i = 0; i < len; i++) { const day = addDays(from, i); const d = byDay.get(day); bars.push({ key: day, v: d?.value ?? null, ok: d ? hit(tab, d) : null }); }
  } else {
    for (let s = from; s <= lastDay; s = addDays(s, 7)) {
      const wk = Array.from({ length: 7 }, (_, i) => byDay.get(addDays(s, i))).filter((d): d is HabitDay => !!d && d.day <= lastDay);
      const oks = wk.map((d) => hit(tab, d)).filter((x): x is boolean => x != null);
      bars.push({ key: s, v: mean(wk.map((d) => d.value)), ok: oks.length ? oks.filter(Boolean).length >= oks.length / 2 : null });
    }
  }
  const line = tab === "sleep" ? SLEEP_H : tab === "steps" ? STEPS : kcalTarget;
  const top = Math.max(line ?? 0, ...rows.map((d) => d.value), tab === "sleep" ? 9 : 0) * 1.08 || 1;

  const fmt = (v: number) => (tab === "sleep" ? h1(v) : n0(v));
  const avgProtein = tab === "food" ? mean(rows.map((d) => d.protein ?? 0)) : null;
  const goalText = tab === "sleep" ? `nights at ${SLEEP_H} h or more` : tab === "steps" ? "days at 10,000 or more" : "days on calorie target";
  const avgLabel = tab === "sleep" ? "avg per night" : tab === "steps" ? "avg steps a day" : `avg kcal${kcalTarget ? ` / ${n0(kcalTarget)}` : ""}`;
  const avgGood = avg == null ? null : tab === "food" ? (kcalTarget ? avg <= kcalTarget * 1.05 : null) : hit(tab, { value: avg });
  const lineText = tab === "sleep" ? `${SLEEP_H} hours` : tab === "steps" ? "10,000 steps" : "your calorie target";

  return (
    <section className="card" style={{ padding: "16px 18px", display: "grid", gap: 16 }} aria-label="Sleep, steps and food">
      <p className="sec">Daily habits</p>

      <div className="segc" role="tablist" aria-label="Show" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        {TABS.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? "on" : ""} onClick={() => pickTab(t.k)} style={{ height: 44, fontSize: 16 }}>{t.l}</button>
        ))}
      </div>

      <div role="group" aria-label="Time range" style={{ display: "grid", gridTemplateColumns: `repeat(${RANGES.length}, minmax(0,1fr))`, gap: 6 }}>
        {RANGES.map((x) => (
          <button key={x.k} type="button" aria-pressed={range === x.k} onClick={() => setRange(x.k)}
            className="pill" style={{ padding: 0, minWidth: 0, ...(range === x.k ? { background: "var(--rust)", borderColor: "var(--rust)", color: "#fff", fontWeight: 800 } : {}) }}>{x.l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="stat">
          <b style={{ color: avgGood == null ? undefined : avgGood ? "var(--jade)" : "var(--crimson)" }}>{avg == null ? "–" : fmt(avg)}</b>
          <span>{avgLabel}{avg != null && avgPrev != null ? `, ${avg >= avgPrev ? "up" : "down"} from ${fmt(avgPrev)}` : ""}</span>
        </div>
        {tab === "food" ? (
          <div className="stat">
            <b style={{ color: avgProtein == null || !proteinTarget ? undefined : avgProtein >= proteinTarget * 0.95 ? "var(--jade)" : "var(--crimson)" }}>{avgProtein == null ? "–" : `${Math.round(avgProtein)} g`}</b>
            <span>avg protein{proteinTarget ? ` / ${proteinTarget} g` : ""}</span>
          </div>
        ) : (
          <div className="stat">
            <b>{scored.length ? `${hits} of ${scored.length}` : "–"}</b>
            <span>{goalText}</span>
          </div>
        )}
      </div>
      {tab === "food" && scored.length ? <p style={{ fontSize: 16, fontWeight: 600 }}>{hits} of {scored.length} {goalText}</p> : null}

      {rows.length ? (
        <div style={{ position: "relative", height: 96 }} role="img"
          aria-label={`${TABS.find((t) => t.k === tab)!.l} ${weekly ? "per week on average" : "per day"} since ${fmtShort(from)}. Dashed line is ${lineText}. Green hit it, red didn't.`}>
          {line ? <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(line / top) * 100}%`, borderTop: "1.5px dashed var(--mist)" }} /> : null}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, minmax(0,1fr))`, gap: bars.length > 20 ? 3 : 6, alignItems: "end", height: "100%" }}>
            {bars.map((b) => (
              <div key={b.key} style={{ height: b.v ? `${Math.max(4, (b.v / top) * 100)}%` : 3, borderRadius: 3,
                background: b.v == null ? "var(--line-soft)" : b.ok == null ? "var(--kingfisher)" : b.ok ? "var(--jade)" : "var(--crimson)" }} />
            ))}
          </div>
        </div>
      ) : (
        <p className="cap">Nothing logged in this range.</p>
      )}
      <p className="cap">{fmtShort(from)} to {fmtShort(lastDay)}{weekly ? ", one bar per week" : ""}. Dashed line is {lineText}.</p>
    </section>
  );
}
