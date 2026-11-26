/** Calories and protein so far against the day's targets. */
export function IntakeBars({ kcal, protein, targetKcal, targetProtein, compact }: {
  kcal: number; protein: number; targetKcal: number | null; targetProtein: number | null; compact?: boolean;
}) {
  const rows = [
    { label: "Calories", val: Math.round(kcal), target: targetKcal, unit: "", color: "var(--kingfisher)", over: "var(--rust)" },
    { label: "Protein", val: Math.round(protein), target: targetProtein, unit: " g", color: "var(--ember)", over: "var(--ember)" },
  ];
  return (
    <div style={{ display: "grid", gap: compact ? 8 : 12 }}>
      {rows.map((r) => {
        const pct = r.target ? Math.min(100, (r.val / r.target) * 100) : 0;
        const isOver = r.target != null && r.val > r.target;
        return (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: compact ? 13 : 14 }}>
              <span style={{ fontWeight: 600 }}>{r.label}</span>
              <span className="num" style={{ fontSize: compact ? 14 : 16 }}>
                {r.val.toLocaleString("en-US")}{r.target ? <span className="cap" style={{ fontSize: 15 }}> / {r.target.toLocaleString("en-US")}{r.unit}</span> : r.unit}
              </span>
            </div>
            <div style={{ height: compact ? 6 : 8, borderRadius: 4, background: "var(--line-soft)", marginTop: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: isOver ? r.over : r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function leftLine(kcal: number, protein: number, targetKcal: number | null, targetProtein: number | null) {
  if (!targetKcal) return "Set your targets in Settings → Profile.";
  const k = Math.round(targetKcal - kcal);
  const p = targetProtein ? Math.round(targetProtein - protein) : null;
  const kPart = k >= 0 ? `${k.toLocaleString("en-US")} kcal left` : `${Math.abs(k).toLocaleString("en-US")} kcal over`;
  const pPart = p == null ? "" : p > 0 ? `, ${p} g protein to go` : ", protein hit";
  return kPart + pPart;
}
