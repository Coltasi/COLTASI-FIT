import Link from "next/link";
import type { ReactNode } from "react";

export function ProgressTabs({ active }: { active: "body" | "lifting" }) {
  return (
    <nav className="segc" aria-label="Progress view">
      <Link href="/progress" className={active === "body" ? "on" : ""} aria-current={active === "body" ? "page" : undefined}>Body</Link>
      <Link href="/progress/lifting" className={active === "lifting" ? "on" : ""} aria-current={active === "lifting" ? "page" : undefined}>Lifting</Link>
    </nav>
  );
}

export function Sparkline({ values, width = 56, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${2 + (i * (width - 4)) / (values.length - 1)},${height - 3 - ((v - min) / span) * (height - 6)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--kingfisher)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Simple time-series line chart: x = day index, y = value; markers per series. */
export function LineChart({ points, markers = [], height = 120, ariaLabel, xLabels, unitLabel, highlightLast }: {
  points: { x: number; y: number }[];
  markers?: { x: number; y: number; kind: "big" | "small" | "accent" }[];
  height?: number; ariaLabel: string; xLabels: string[]; unitLabel?: string; highlightLast?: boolean;
}): ReactNode {
  const all = [...points, ...markers];
  if (!all.length) return null;
  const W = 320, H = height, top = 18, bottom = H - 18, left = 4, right = W - 34;
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  let minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  if (maxY - minY < 1) { minY -= 0.5; maxY += 0.5; }
  const sx = (x: number) => left + ((x - minX) / (maxX - minX || 1)) * (right - left);
  const sy = (y: number) => bottom - ((y - minY) / (maxY - minY)) * (bottom - top);
  const line = [...points].sort((a, b) => a.x - b.x).map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString());
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel}>
        <line x1={0} y1={top} x2={right} y2={top} stroke="var(--line-soft)" />
        <line x1={0} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} stroke="var(--line-soft)" />
        <line x1={0} y1={bottom} x2={right} y2={bottom} stroke="var(--line-strong)" />
        <text x={W} y={top + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Montserrat, sans-serif">{fmt(maxY)}{unitLabel ? ` ${unitLabel}` : ""}</text>
        <text x={W} y={bottom + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Montserrat, sans-serif">{fmt(minY)}</text>
        {points.length > 1 ? <polyline points={line} fill="none" stroke="var(--kingfisher)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {markers.filter((m) => m.kind === "small").map((m, i) => <circle key={`s${i}`} cx={sx(m.x)} cy={sy(m.y)} r={2.6} fill="#9FCBDF" />)}
        {markers.filter((m) => m.kind === "big").map((m, i) => <circle key={`b${i}`} cx={sx(m.x)} cy={sy(m.y)} r={4.5} fill="var(--kingfisher)" />)}
        {markers.filter((m) => m.kind === "accent").map((m, i) => <circle key={`a${i}`} cx={sx(m.x)} cy={sy(m.y)} r={5} fill="var(--ember)" />)}
        {highlightLast && points.length ? (() => { const p = [...points].sort((a, b) => a.x - b.x).at(-1)!; return <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill="#fff" stroke="var(--kingfisher)" strokeWidth={2} />; })() : null}
      </svg>
      <div className="cap" style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingRight: 34 }}>
        {xLabels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </>
  );
}
