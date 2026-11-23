"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, daysBetween, fmtMonth, fmtShort } from "@/lib/dates";
import { signed, unit, w, type Units } from "@/lib/units";

export type MetricKey = "weight" | "muscle" | "water" | "fat";
export type CompPoint = { d: string; kg: number; src: "scan" | "weigh-in" };

// Brand kit: Deep Navy, Kingfisher, Lagoon, Ember.
const METRICS: { key: MetricKey; label: string; color: string; goodDown: boolean | null }[] = [
  { key: "weight", label: "Weight", color: "var(--navy)", goodDown: true },
  { key: "muscle", label: "Muscle", color: "var(--kingfisher)", goodDown: false },
  { key: "water", label: "Water", color: "var(--lagoon)", goodDown: null },
  { key: "fat", label: "Fat", color: "var(--ember)", goodDown: true },
];
const STORE_KEY = "coltasi.bodycomp.metrics";
const DEFAULT_ON: MetricKey[] = ["weight", "muscle", "water", "fat"];
const RANGES = [{ k: "3m", l: "3M", days: 91 }, { k: "6m", l: "6M", days: 183 }, { k: "all", l: "All", days: null }] as const;
type RangeKey = (typeof RANGES)[number]["k"];

/**
 * Body comp overlay chart. Every series is a mass in kg (shown in kg or lb),
 * so they share one honest y-axis. Water and fat come off the Tanita % readings
 * multiplied by that scan's weight when the scan didn't store the mass itself.
 */
export function BodyCompChart({ series: full, units }: { series: Record<MetricKey, CompPoint[]>; units: Units }) {
  const [range, setRange] = useState<RangeKey>("all");
  const lastDate = useMemo(() => METRICS.flatMap((m) => full[m.key].map((p) => p.d)).sort().at(-1), [full]);
  const series = useMemo(() => {
    const days = RANGES.find((r) => r.k === range)?.days;
    if (!days || !lastDate) return full;
    const cut = addDays(lastDate, -days);
    const cutSeries = Object.fromEntries(METRICS.map((m) => [m.key, full[m.key].filter((p) => p.d >= cut)])) as Record<MetricKey, CompPoint[]>;
    // Nothing logged in that window: fall back to everything rather than an empty chart.
    return METRICS.some((m) => cutSeries[m.key].length) ? cutSeries : full;
  }, [full, range, lastDate]);
  const [on, setOn] = useState<MetricKey[]>(DEFAULT_ON);
  const [sel, setSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-device preference after hydration
      if (Array.isArray(saved)) setOn(saved.filter((k) => METRICS.some((m) => m.key === k)));
    } catch { /* storage unavailable: keep defaults */ }
  }, []);

  const toggle = (k: MetricKey) => {
    setOn((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const visible = METRICS.filter((m) => on.includes(m.key) && series[m.key].length);
  const allDates = useMemo(
    () => [...new Set(METRICS.flatMap((m) => series[m.key].map((p) => p.d)))].sort(),
    [series],
  );
  const x0 = allDates[0];
  const x1 = allDates.at(-1);
  // Dates you can tap to: scans when any scan metric is on, plus weigh-ins when weight is on.
  const tapDates = [...new Set(visible.flatMap((m) => series[m.key].map((p) => p.d)))].sort();
  const active = sel && tapDates.includes(sel) ? sel : tapDates.at(-1) ?? null;

  if (!x0 || !x1) return null;

  const W = 320, H = 210, top = 12, bottom = H - 14, left = 4, right = W - 40;
  const vals = visible.flatMap((m) => series[m.key].map((p) => conv(p.kg)));
  let minY = vals.length ? Math.min(...vals) : 0;
  let maxY = vals.length ? Math.max(...vals) : 1;
  const pad = Math.max((maxY - minY) * 0.08, 1);
  minY = Math.floor(minY - pad);
  maxY = Math.ceil(maxY + pad);
  const span = daysBetween(x0, x1) || 1;
  const sx = (d: string) => left + (daysBetween(x0, d) / span) * (right - left);
  const sy = (v: number) => bottom - ((v - minY) / (maxY - minY)) * (bottom - top);
  const ticks = [maxY, (maxY + minY) / 2, minY];
  const months = [...new Set(allDates.map(fmtMonth))];

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !tapDates.length) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = tapDates[0], dist = Infinity;
    for (const d of tapDates) { const dd = Math.abs(sx(d) - x); if (dd < dist) { dist = dd; best = d; } }
    setSel(best);
  };

  const at = (k: MetricKey, d: string) => series[k].find((p) => p.d === d);
  const firstOf = (k: MetricKey) => series[k][0];

  return (
    <div className="card" style={{ padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p className="lab">Body composition · {unit(units)}</p>
        <div role="group" aria-label="Time range" style={{ display: "flex", gap: 4, background: "var(--tint-neutral)", borderRadius: 9, padding: 3 }}>
          {RANGES.map((r) => (
            <button key={r.k} type="button" aria-pressed={range === r.k} onClick={() => { setRange(r.k); setSel(null); }}
              style={{ height: 26, minWidth: 34, borderRadius: 7, border: 0, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                background: range === r.k ? "#fff" : "transparent", color: range === r.k ? "var(--navy)" : "var(--muted)",
                boxShadow: range === r.k ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{r.l}</button>
          ))}
        </div>
      </div>

      <div role="group" aria-label="Metrics to show" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6, marginBottom: 12 }}>
        {METRICS.map((m) => {
          const isOn = on.includes(m.key);
          const empty = !full[m.key].length;
          return (
            <button
              key={m.key}
              type="button"
              role="checkbox"
              aria-checked={isOn}
              disabled={empty}
              onClick={() => toggle(m.key)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderRadius: 10,
                border: `1.5px solid ${isOn ? m.color : "var(--line-strong)"}`, background: "#fff",
                fontSize: 13, fontWeight: 600, color: isOn ? "var(--navy)" : "var(--muted)",
                cursor: empty ? "default" : "pointer", opacity: empty ? 0.4 : 1, padding: 0, fontFamily: "inherit",
              }}
            >
              <span aria-hidden style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: isOn ? m.color : "#fff", border: `1.5px solid ${isOn ? m.color : "var(--check-line)"}`,
              }}>
                {isOn ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5.2 4 7.5 8.5 2.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </span>
              {m.label}
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            role="img"
            aria-label={`Body composition in ${unit(units)}: ${visible.map((m) => m.label).join(", ")}. Tap to see a date.`}
            onPointerDown={onPointer}
            onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") onPointer(e); }}
            style={{ touchAction: "pan-y", cursor: "crosshair", display: "block" }}
          >
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={0} y1={sy(t)} x2={right} y2={sy(t)} stroke={i === 2 ? "var(--line-strong)" : "var(--line-soft)"} />
                <text x={W} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Montserrat, sans-serif">{Math.round(t)}</text>
              </g>
            ))}
            {active ? <line x1={sx(active)} y1={top} x2={sx(active)} y2={bottom} stroke="var(--mist)" strokeDasharray="3 3" /> : null}
            {visible.map((m) => {
              const pts = series[m.key];
              const poly = pts.map((p) => `${sx(p.d).toFixed(1)},${sy(conv(p.kg)).toFixed(1)}`).join(" ");
              return (
                <g key={m.key}>
                  {pts.length > 1 ? <polyline points={poly} fill="none" stroke={m.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
                  {pts.map((p) => {
                    const hit = p.d === active;
                    const r = p.src === "scan" ? (hit ? 5.5 : 3.8) : hit ? 4 : 2.4;
                    return <circle key={p.d} cx={sx(p.d)} cy={sy(conv(p.kg))} r={r} fill={hit ? "#fff" : m.color} stroke={m.color} strokeWidth={hit ? 2.2 : 0} />;
                  })}
                </g>
              );
            })}
          </svg>
          <div className="cap" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingRight: 40 }}>
            {months.map((l) => <span key={l}>{l}</span>)}
          </div>

          {active ? (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
              <p className="cap" style={{ marginBottom: 6 }}>
                <strong style={{ color: "var(--navy)" }}>{fmtShort(active)}</strong>
                {visible.some((m) => at(m.key, active)?.src === "scan") ? " · Tanita scan" : " · weigh-in"}
                {" · change since "}{fmtShort(x0)}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))`, gap: 8 }}>
                {visible.map((m) => {
                  const p = at(m.key, active);
                  const f = firstOf(m.key);
                  const d = p && f && f.d !== p.d ? conv(p.kg) - conv(f.kg) : null;
                  const good = d == null || m.goodDown == null ? null : (d < 0) === m.goodDown;
                  return (
                    <div key={m.key}>
                      <p className="cap" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />{m.label}
                      </p>
                      <p className="num" style={{ fontSize: 19, marginTop: 2 }}>{p ? w(p.kg, units) : "–"}</p>
                      {d != null ? (
                        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: good == null ? "var(--muted)" : good ? "var(--kingfisher-text)" : "var(--rust)" }}>
                          {signed(d)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="cap" style={{ padding: "30px 0", textAlign: "center" }}>Tick a metric to plot it.</p>
      )}
    </div>
  );
}
