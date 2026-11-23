"use client";

import { useRef, useState } from "react";
import { daysBetween, fmtMonth, fmtShort } from "@/lib/dates";
import { signed, unit, w, type Units } from "@/lib/units";

export type LiftPoint = { date: string; top: number; reps: (number | null)[]; pr: boolean };

/** Top-set weight over time. Ember dots are personal bests; tap any session to read it. */
export function LiftChart({ points, units }: { points: LiftPoint[]; units: Units }) {
  const [sel, setSel] = useState<number>(points.length - 1);
  const ref = useRef<SVGSVGElement>(null);
  if (points.length < 2) return null;

  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const W = 320, H = 160, top = 22, bottom = H - 12, left = 6, right = W - 40;
  const x0 = points[0].date, span = daysBetween(x0, points.at(-1)!.date) || 1;
  let minY = Math.min(...points.map((p) => conv(p.top))), maxY = Math.max(...points.map((p) => conv(p.top)));
  const pad = Math.max((maxY - minY) * 0.1, 1);
  minY = Math.floor(minY - pad); maxY = Math.ceil(maxY + pad);
  const sx = (d: string) => left + (daysBetween(x0, d) / span) * (right - left);
  const sy = (v: number) => bottom - ((conv(v) - minY) / (maxY - minY)) * (bottom - top);
  // Running best as a step line, so plateaus and jumps read at a glance.
  let best = -Infinity;
  const step: string[] = [];
  points.forEach((p, i) => {
    if (p.top > best) best = p.top;
    const x = sx(p.date).toFixed(1), y = sy(best).toFixed(1);
    if (i) step.push(`${x},${step.at(-1)!.split(",")[1]}`);
    step.push(`${x},${y}`);
  });

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = ref.current?.getBoundingClientRect();
    if (!b) return;
    const x = ((e.clientX - b.left) / b.width) * W;
    let bi = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(sx(p.date) - x); if (d < bd) { bd = d; bi = i; } });
    setSel(bi);
  };

  const p = points[sel] ?? points.at(-1)!;
  const prev = points[sel - 1];
  const prs = points.filter((q) => q.pr).length;

  return (
    <div className="card" style={{ padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p className="lab">Top set weight</p>
        <span className="cap" style={{ display: "flex", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ember)" }} />PR{prs === 1 ? "" : "s"} · {prs}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, borderTop: "2px dashed var(--mist)" }} />Best so far</span>
        </span>
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Top set weight from ${w(points[0].top, units)} to ${w(points.at(-1)!.top, units)} ${unit(units)}. Tap a session to read it.`}
        onPointerDown={pick} onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") pick(e); }}
        style={{ touchAction: "pan-y", cursor: "crosshair", display: "block" }}>
        {[maxY, (maxY + minY) / 2, minY].map((t, i) => {
          const y = bottom - ((t - minY) / (maxY - minY)) * (bottom - top);
          return (
            <g key={i}>
              <line x1={0} y1={y} x2={right} y2={y} stroke={i === 2 ? "var(--line-strong)" : "var(--line-soft)"} />
              <text x={W} y={y + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Montserrat, sans-serif">{Math.round(t)}</text>
            </g>
          );
        })}
        <line x1={sx(p.date)} y1={top - 8} x2={sx(p.date)} y2={bottom} stroke="var(--mist)" strokeDasharray="3 3" />
        <polyline points={step.join(" ")} fill="none" stroke="var(--mist)" strokeWidth={1.5} strokeDasharray="4 3" />
        <polyline points={points.map((q) => `${sx(q.date).toFixed(1)},${sy(q.top).toFixed(1)}`).join(" ")} fill="none" stroke="var(--kingfisher)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((q, i) => {
          const hit = i === sel;
          const c = q.pr ? "var(--ember)" : "var(--kingfisher)";
          return (
            <g key={q.date + i}>
              <circle cx={sx(q.date)} cy={sy(q.top)} r={hit ? 6 : q.pr ? 5 : 3.6} fill={hit ? "#fff" : c} stroke={c} strokeWidth={hit ? 2.4 : 0} />
              {q.pr ? <text x={sx(q.date)} y={sy(q.top) - 9} textAnchor="middle" fontSize={9} fontWeight={800} fill="var(--rust)" fontFamily="Montserrat, sans-serif">PR</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="cap" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingRight: 40 }}>
        {[...new Set(points.map((q) => fmtMonth(q.date)))].map((l) => <span key={l}>{l}</span>)}
      </div>
      <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{fmtShort(p.date)}</strong>
        <span className="num" style={{ fontSize: 20 }}>{w(p.top, units)}<span style={{ fontSize: 13 }}> {unit(units)}</span></span>
        <span className="cap">× {p.reps.map((r) => r ?? "?").join(", ")}</span>
        {prev ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: p.top > prev.top ? "var(--kingfisher-text)" : p.top < prev.top ? "var(--rust)" : "var(--muted)" }}>
            {signed(conv(p.top) - conv(prev.top))} vs {fmtShort(prev.date)}
          </span>
        ) : null}
        {p.pr ? <span className="tag ember">PR</span> : null}
      </div>
    </div>
  );
}
