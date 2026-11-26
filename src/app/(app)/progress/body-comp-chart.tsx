"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, daysBetween, fmtMonth, fmtShort } from "@/lib/dates";
import { signed, unit, type Units } from "@/lib/units";
import { setPref } from "../settings/actions";

export type MetricKey = "weight" | "muscle" | "water" | "fat";
/** One reading: as a mass in kg and as a % of body weight (null when it can't be worked out). */
export type CompPoint = { d: string; kg: number | null; pct: number | null; src: "scan" | "weigh-in" };
type Mode = "mass" | "pct";

// Brand kit: Deep Navy, Kingfisher, Lagoon, Ember.
/** `pctLabel`: the name when shown as a % of body weight. */
const METRICS: { key: MetricKey; label: string; pctLabel: string; color: string; goodDown: boolean | null }[] = [
  { key: "weight", label: "Weight", pctLabel: "Weight", color: "var(--navy)", goodDown: true },
  { key: "fat", label: "Fat mass", pctLabel: "Body fat", color: "var(--ember)", goodDown: true },
  { key: "muscle", label: "Muscle", pctLabel: "Muscle", color: "var(--kingfisher)", goodDown: false },
  { key: "water", label: "Body water", pctLabel: "Body water", color: "var(--kingfisher-text)", goodDown: null },
];
const STORE_KEY = "coltasi.bodycomp.selected";
const MODE_KEY = "coltasi.bodycomp.mode";
// Same ranges and look as the Food deficit card. YTD runs from 1 January of the latest point's year.
const RANGES = [{ k: "1w", l: "1W", days: 7 }, { k: "1m", l: "1M", days: 31 }, { k: "3m", l: "3M", days: 91 }, { k: "6m", l: "6M", days: 183 }, { k: "ytd", l: "YTD", days: null }, { k: "1y", l: "1Y", days: 365 }] as const;
type RangeKey = (typeof RANGES)[number]["k"];

const goodColor = (d: number, goodDown: boolean | null) =>
  goodDown == null || Math.abs(d) < 0.05 ? "var(--muted)" : (d < 0) === goodDown ? "var(--jade)" : "var(--crimson)";

/**
 * Body comp: a 2x2 grid of tiles (latest value, change over the range, sparkline), and one big chart for the
 * selected tile on its own scale, so a 2 kg change in muscle is visible instead of flattened against weight.
 * Two switches: kg/lb (the app-wide units setting) and mass/% (fat, muscle and water as a share of body weight;
 * body weight itself always shows as a mass).
 */
export function BodyCompChart({ series: raw, units: initialUnits }: { series: Record<MetricKey, CompPoint[]>; units: Units }) {
  const router = useRouter();
  const [, startUnits] = useTransition();
  const [units, setUnits] = useState<Units>(initialUnits);
  const [mode, setMode] = useState<Mode>("mass");
  const [range, setRange] = useState<RangeKey>("1w");
  const [selKey, setSelKey] = useState<MetricKey>("weight");
  const [pick, setPick] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-device preference after hydration
      if (saved && METRICS.some((m) => m.key === saved)) setSelKey(saved as MetricKey);
      if (localStorage.getItem(MODE_KEY) === "pct") setMode("pct");
    } catch { /* storage unavailable: keep default */ }
  }, []);

  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const isPct = (k: MetricKey) => mode === "pct" && k !== "weight";
  /** The number to show and plot for a point, in the chosen units and mode. */
  const val = (k: MetricKey, p: CompPoint) => (isPct(k) ? p.pct! : conv(p.kg!));
  const nameOf = (m: (typeof METRICS)[number]) => (isPct(m.key) ? m.pctLabel : m.label);
  const suffix = (k: MetricKey) => (isPct(k) ? "%" : unit(units));
  const fmt = (v: number) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  // Only points that have a value in the current mode.
  const full = useMemo(() => Object.fromEntries(METRICS.map((m) => [m.key,
    raw[m.key].filter((p) => (mode === "pct" && m.key !== "weight" ? p.pct != null : p.kg != null))])) as Record<MetricKey, CompPoint[]>, [raw, mode]);

  const switchUnits = (u: Units) => {
    if (u === units) return;
    setUnits(u);
    startUnits(async () => { await setPref("units", u); router.refresh(); });
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setPick(null);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  };

  const lastDate = useMemo(() => METRICS.flatMap((m) => full[m.key].map((p) => p.d)).sort().at(-1), [full]);
  const series = useMemo(() => {
    if (!lastDate) return full;
    const days = RANGES.find((r) => r.k === range)?.days;
    const cut = range === "ytd" ? `${lastDate.slice(0, 4)}-01-01` : addDays(lastDate, -(days ?? 365));
    // A metric with fewer than two points in the window keeps its full history rather than showing a single dot.
    return Object.fromEntries(METRICS.map((m) => {
      const inRange = full[m.key].filter((p) => p.d >= cut);
      return [m.key, inRange.length >= 2 ? inRange : full[m.key]];
    })) as Record<MetricKey, CompPoint[]>;
  }, [full, range, lastDate]);

  const available = METRICS.filter((m) => series[m.key].length);
  if (!available.length) return null;
  const sel = available.find((m) => m.key === selKey) ?? available[0];
  const pts = series[sel.key];
  const first = pts[0];
  const active = pts.find((p) => p.d === pick) ?? pts.at(-1)!;
  const change = val(sel.key, active) - val(sel.key, first);

  const select = (k: MetricKey) => {
    setSelKey(k);
    setPick(null);
    try { localStorage.setItem(STORE_KEY, k); } catch { /* ignore */ }
  };

  // Big chart geometry.
  const W = 340, H = 180, top = 12, bottom = H - 22, left = 8, right = W - 38;
  const vals = pts.map((p) => val(sel.key, p));
  const lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const span = daysBetween(first.d, pts.at(-1)!.d) || 1;
  const sx = (d: string) => (pts.length === 1 ? (left + right) / 2 : left + (daysBetween(first.d, d) / span) * (right - left));
  const sy = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  const ticks = [hi, (hi + lo) / 2, lo];
  const monthMarks: { d: string; l: string }[] = [];
  for (const p of pts) { const l = fmtMonth(p.d); if (!monthMarks.some((m) => m.l === l)) monthMarks.push({ d: p.d, l }); }
  // Keep month labels from colliding on a narrow chart.
  const months = monthMarks.filter((m, i, a) => i === 0 || sx(m.d) - sx(a[i - 1].d) > 26);

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = pts[0], dist = Infinity;
    for (const p of pts) { const dd = Math.abs(sx(p.d) - x); if (dd < dist || (dd === dist && p.src === "scan")) { dist = dd; best = p; } }
    setPick(best.d);
  };

  return (
    <div className="card" style={{ padding: "16px 16px 12px" }}>
      <p className="sec" style={{ marginBottom: 12 }}>Trend</p>
      <div role="group" aria-label="Time range" style={{ display: "grid", gridTemplateColumns: `repeat(${RANGES.length}, minmax(0,1fr))`, gap: 6, marginBottom: 12 }}>
        {RANGES.map((r) => (
          <button key={r.k} type="button" aria-pressed={range === r.k} onClick={() => { setRange(r.k); setPick(null); }}
            className="pill" style={{ padding: 0, minWidth: 0, ...(range === r.k ? { background: "var(--rust)", borderColor: "var(--rust)", color: "#fff", fontWeight: 800 } : {}) }}>{r.l}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
        <div className="segc" role="group" aria-label="Units">
          {(["metric", "imperial"] as const).map((u) => (
            <button key={u} type="button" className={units === u ? "on" : ""} aria-pressed={units === u} onClick={() => switchUnits(u)}>{unit(u)}</button>
          ))}
        </div>
        <div className="segc" role="group" aria-label="Show body composition as">
          {([["mass", "Weight"], ["pct", "%"]] as const).map(([m, l]) => (
            <button key={m} type="button" className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => switchMode(m)}>{l}</button>
          ))}
        </div>
      </div>

      <div role="radiogroup" aria-label="Metric" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        {METRICS.map((m) => {
          const p = series[m.key];
          const isSel = m.key === sel.key;
          if (!p.length) {
            return (
              <div key={m.key} style={{ padding: "12px 14px", borderRadius: 14, background: "var(--tint-neutral)", opacity: 0.5 }}>
                <p className="cap" style={{ fontSize: 15 }}>{m.label}</p><p className="cap" style={{ marginTop: 4 }}>No data</p>
              </div>
            );
          }
          const d = val(m.key, p.at(-1)!) - val(m.key, p[0]);
          return (
            <button key={m.key} type="button" role="radio" aria-checked={isSel} onClick={() => select(m.key)}
              style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", minWidth: 0,
                background: isSel ? "#fff" : "var(--tint-neutral)", border: `2px solid ${isSel ? m.color : "transparent"}` }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(m)}</span>
                {p.length > 1 ? <span style={{ fontSize: 15, fontWeight: 700, color: goodColor(d, m.goodDown) }}>{signed(d)}{isPct(m.key) ? "%" : ""}</span> : null}
              </span>
              <span className="num" style={{ display: "block", fontSize: 24, fontWeight: 800, color: "var(--navy)", whiteSpace: "nowrap", marginTop: 2, letterSpacing: "-0.02em" }}>
                {fmt(val(m.key, p.at(-1)!))}<span style={{ fontSize: 15, fontWeight: 600, color: "var(--muted)", marginLeft: isPct(m.key) ? 1 : 4 }}>{suffix(m.key)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="num" style={{ fontSize: 28, color: "var(--navy)" }}>{fmt(val(sel.key, active))}{isPct(sel.key) ? "" : " "}<span className="cap">{suffix(sel.key)}</span></span>
          {active.d !== first.d ? (
            <span style={{ fontSize: 15, fontWeight: 700, color: goodColor(change, sel.goodDown) }}>{signed(change)}{isPct(sel.key) ? "%" : ` ${unit(units)}`} since {fmtShort(first.d)}</span>
          ) : null}
        </div>
        <p className="cap" style={{ marginTop: 2, fontSize: 15 }}>{nameOf(sel)}{isPct(sel.key) ? " (% of body weight)" : ""} · {fmtShort(active.d)}{active.src === "scan" ? " · scan" : ""}</p>

        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${nameOf(sel)} over time, ${isPct(sel.key) ? "% of body weight" : unit(units)}. Tap to see a date.`}
          onPointerDown={onPointer}
          onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") onPointer(e); }}
          style={{ display: "block", marginTop: 8, touchAction: "pan-y", cursor: "crosshair" }}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={0} x2={right} y1={sy(t)} y2={sy(t)} stroke={i === 2 ? "var(--line-strong)" : "var(--line-soft)"} />
              <text x={W} y={sy(t) + 4} textAnchor="end" fontSize={13} fill="var(--muted)" fontFamily="Inter Variable, Inter, sans-serif">{t % 1 ? t.toFixed(1) : t}</text>
            </g>
          ))}
          <line x1={sx(active.d)} x2={sx(active.d)} y1={top} y2={bottom} stroke="var(--mist)" strokeDasharray="3 3" />
          {pts.length > 1 ? (
            <polyline points={pts.map((p) => `${sx(p.d).toFixed(1)},${sy(val(sel.key, p)).toFixed(1)}`).join(" ")}
              fill="none" stroke={sel.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {pts.map((p) => {
            const hit = p.d === active.d;
            const r = p.src === "scan" ? (hit ? 6 : 4) : hit ? 4.5 : 2.5;
            return <circle key={p.d} cx={sx(p.d)} cy={sy(val(sel.key, p))} r={r} fill={hit ? "#fff" : sel.color} stroke={sel.color} strokeWidth={hit ? 2.5 : 0} />;
          })}
          {months.map((m) => (
            <text key={m.l} x={Math.min(Math.max(sx(m.d), 14), right - 10)} y={H - 4} textAnchor="middle" fontSize={13} fill="var(--muted)" fontFamily="Inter Variable, Inter, sans-serif">{m.l}</text>
          ))}
        </svg>
        <p className="cap" style={{ marginTop: 10, lineHeight: 1.45 }}>
          {sel.key === "weight" && mode === "pct"
            ? "Body weight always shows in " + unit(units) + ". Big dots are Tanita scans, small dots are weigh-ins."
            : sel.key === "weight"
            ? "Big dots are Tanita scans, small dots are weigh-ins. Tap the chart to inspect a day."
            : "Tanita scan estimate (bioimpedance). Small swings between scans are normal: read the trend, not one reading."}
        </p>
      </div>
    </div>
  );
}
