import { EFFORT_COLOR, EFFORT_LABEL, effortCallout, isEffort, type Verdict } from "@/lib/effort";

/** A small effort pill. */
export function EffortTag({ grade, prefix }: { grade: string | null | undefined; prefix?: string }) {
  if (!isEffort(grade)) return null;
  const c = EFFORT_COLOR[grade];
  return <span className="tag" style={{ background: c.bg, color: c.fg }}>{prefix ? `${prefix} · ` : ""}{EFFORT_LABEL[grade]}</span>;
}

/** Your rating next to the Coach's grade from the logs, with one honest line when they disagree. */
export function EffortCard({ self, verdict, feel }: { self: string | null; verdict: Verdict | null; feel?: string | null }) {
  const mine = isEffort(self) ? self : null;
  if (!mine && !verdict) return null;
  const callout = effortCallout(mine, verdict, feel);
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <p className="lab" style={{ color: "var(--navy)" }}>Effort</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <p className="cap" style={{ fontSize: 12 }}>You said</p>
          <div style={{ marginTop: 4 }}>{mine ? <EffortTag grade={mine} /> : <span className="cap">Not rated</span>}</div>
        </div>
        <div>
          <p className="cap" style={{ fontSize: 12 }}>Coach says</p>
          <div style={{ marginTop: 4 }}>{verdict ? <EffortTag grade={verdict.grade} /> : <span className="cap">Not enough to compare</span>}</div>
        </div>
      </div>
      {verdict ? <p className="cap" style={{ color: "var(--navy)" }}>{verdict.line}</p> : null}
      {callout ? <p className="cap" style={{ color: "var(--rust)", fontWeight: 600 }}>{callout}</p> : null}
    </div>
  );
}
