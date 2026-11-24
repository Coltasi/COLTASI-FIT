import { BackHeader } from "@/components/ui";
import { IconDown, IconPen } from "@/components/icons";
import { reopenSession } from "../../actions";
import { fmtLong } from "@/lib/dates";
import { unit, w, type Units } from "@/lib/units";
import { SKIP_LABEL, type SkipReason } from "@/lib/owed";
import { EffortTag } from "@/components/effort";
import { EFFORT_LABEL, effortCallout, isEffort, type Effort, type Verdict } from "@/lib/effort";
import { isHardSet, SET_EFFORT_LABEL, type SetEffort } from "@/lib/set-effort";
import { FEEL_LABEL, PAIN_LABEL, type Feel, type PainArea } from "@/lib/check-in";

/** Read-only view of a finished (or skipped) session: every logged set per lift. */
export function LoggedView({ id, saved, title, date, status, units, lifts, checkIn, verdict, weekHard = 0 }: {
  id: string; saved?: boolean; title: string; date: string; status: string; units: Units;
  checkIn?: { feel: string | null; pains: string[]; notes: string | null; effort?: string | null };
  verdict?: Verdict | null;
  /** Hard + failed sets across this workout's week (Sunday first). */
  weekHard?: number;
  lifts: { id: string; name: string; skipped: string | null; skill: boolean; outcome?: 1 | 0 | -1 | null; sets: { weight_kg: number | null; reps: number | null; effort?: SetEffort | null }[] }[];
}) {
  const logged = lifts.filter((l) => l.sets.length);
  const skipped = lifts.filter((l) => !l.sets.length && l.skipped);
  const missed = lifts.filter((l) => !l.sets.length && !l.skipped);
  const setCount = logged.reduce((n, l) => n + l.sets.length, 0);
  const planned = lifts.length;
  const working = logged.filter((l) => !l.skill).flatMap((l) => l.sets);
  const hardSets = working.filter((z) => isHardSet(z.effort)).length;
  const failedSets = working.filter((z) => z.effort === "failed").length;
  const rated = working.some((z) => z.effort);
  const mine: Effort | null = isEffort(checkIn?.effort) ? checkIn.effort : null;
  const callout = status === "done" ? effortCallout(mine, verdict ?? null, checkIn?.feel ?? null) : null;

  const top = (l: (typeof lifts)[number]) => {
    if (l.skill) { const best = Math.max(...l.sets.map((z) => z.reps ?? 0)); return `Best hold ${best} s`; }
    const withKg = l.sets.filter((z) => z.weight_kg != null && z.weight_kg > 0);
    if (!withKg.length) { const best = Math.max(...l.sets.map((z) => z.reps ?? 0)); return `Bodyweight · best ${best} reps`; }
    const t = withKg.reduce((a, z) => ((z.weight_kg ?? 0) > (a.weight_kg ?? 0) || ((z.weight_kg ?? 0) === (a.weight_kg ?? 0) && (z.reps ?? 0) > (a.reps ?? 0)) ? z : a));
    return `Top set ${w(t.weight_kg!, units)} ${unit(units)} × ${t.reps ?? "?"}`;
  };
  const OUT = {
    1: { t: "↑ Beat last time", c: "jade" },
    0: { t: "= Matched", c: "neutral" },
    [-1]: { t: "↓ Below last time", c: "ember" },
  } as const;

  return (
    <main className="screen" style={{ gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <BackHeader href="/train/history" label="History" eyebrow={status === "skipped" ? `Skipped · ${fmtLong(date)}` : `Workout complete · ${fmtLong(date)}`} title={title} />
        {status === "done" ? (
          <form action={reopenSession.bind(null, id)}>
            <button type="submit" className="btn2" style={{ flexShrink: 0 }}><IconPen size={15} />Edit</button>
          </form>
        ) : null}
      </div>
      {saved ? <p className="cap" style={{ color: "var(--jade)", fontWeight: 700 }}>Changes saved. Your coach will review this workout again.</p> : null}
      {status === "skipped" ? <p className="cap">This session was skipped. Nothing was logged.</p> : null}

      {status === "done" ? (
        <>
          <div className="tiles">
            <div className="tile" style={{ background: "var(--navy)", borderColor: "var(--navy)", color: "#fff" }}>
              <span className="big" style={{ fontSize: 40 }}>{rated ? hardSets : "–"}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>hard sets</span>
            </div>
            <div className="tile">
              <span className="big" style={{ fontSize: 40, color: "var(--rust)" }}>{rated ? failedSets : "–"}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>to failure</span>
            </div>
          </div>
          <div className="tile" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "16px 18px" }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>This week</span>
            <span className="big" style={{ fontSize: 22, marginTop: 0 }}>{weekHard} hard {weekHard === 1 ? "set" : "sets"}</span>
          </div>
          {!rated ? <p className="cap">No sets were rated in this workout. Tap Easy, Hard or Failed after each set next time.</p> : null}
          <div className="tiles">
            <div className="tile"><span className="lab">Lifts logged</span><span className="big">{logged.length}/{planned}</span><span className="cap">{skipped.length ? `${skipped.length} skipped` : missed.length ? `${missed.length} not logged` : "All done"}</span></div>
            <div className="tile"><span className="lab">Improved</span><span className="big" style={{ color: verdict?.better ? "var(--jade)" : undefined }}>{verdict ? verdict.better : "–"}</span><span className="cap">{verdict ? `of ${verdict.compared} compared` : "Not enough history"}</span></div>
            <div className="tile"><span className="lab">Sets</span><span className="big">{setCount}</span><span className="cap">Logged</span></div>
            <div className="tile">
              <span className="lab">Effort</span>
              <span className="big" style={{ fontSize: 24 }}>{mine ? EFFORT_LABEL[mine] : "–"}</span>
              <span className="cap">Your rating</span>
              {verdict ? <span style={{ marginTop: 6, display: "flex" }}><EffortTag grade={verdict.grade} prefix="Coach" /></span> : null}
            </div>
          </div>
          {verdict || callout ? (
            <div className="card cream" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {verdict ? <p style={{ fontSize: 16, lineHeight: 1.45 }}>{verdict.line}</p> : null}
              {callout ? <p style={{ fontSize: 15, color: "var(--rust)", fontWeight: 600 }}>{callout}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {status !== "skipped" && !logged.length ? <p className="cap">No sets were ticked in this session.</p> : null}

      {logged.length || missed.length || skipped.length ? (
        <section>
          <h2 className="sec">Performance breakdown</h2>
          <div className="list">
            {logged.map((l) => {
              const o = l.outcome != null ? OUT[l.outcome] : null;
              return (
                <details key={l.id} className="li" style={{ display: "block" }}>
                  <summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <p className="t" style={{ fontSize: 16 }}>{l.name}</p>
                      <p className="s">{l.sets.length} {l.sets.length === 1 ? "set" : "sets"} · {top(l)}</p>
                      {o ? <span className={`tag ${o.c}`} style={{ display: "inline-block", marginTop: 6 }}>{o.t}</span> : null}
                    </div>
                    <IconDown style={{ color: "var(--stone)", flexShrink: 0 }} />
                  </summary>
                  <div className="card" style={{ marginTop: 10, padding: "8px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) minmax(0,1fr) 72px", gap: "8px 8px", fontSize: 16, alignItems: "center" }}>
                      <span className="lab">Set</span>
                      <span className="lab" style={{ textAlign: "right" }}>{l.skill ? "" : `Weight (${unit(units)})`}</span>
                      <span className="lab" style={{ textAlign: "right" }}>{l.skill ? "Seconds" : "Reps"}</span>
                      <span className="lab" style={{ textAlign: "right" }}>Effort</span>
                      {l.sets.map((z, i) => (
                        <Row key={i} n={i + 1} kg={l.skill ? "" : z.weight_kg ? w(z.weight_kg, units) : "BW"} reps={z.reps == null ? "?" : String(z.reps)} effort={z.effort ?? null} />
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
            {skipped.map((l) => (
              <div key={l.id} className="li">
                <p className="t" style={{ flexGrow: 1, fontSize: 16, color: "var(--muted)" }}>{l.name}</p>
                <span className="tag neutral">Skipped{l.skipped && SKIP_LABEL[l.skipped as SkipReason] ? ` · ${SKIP_LABEL[l.skipped as SkipReason]}` : ""}</span>
              </div>
            ))}
            {missed.map((l) => (
              <div key={l.id} className="li">
                <p className="t" style={{ flexGrow: 1, fontSize: 16, color: "var(--muted)" }}>{l.name}</p>
                <span className="tag dashed">Not logged</span>
              </div>
            ))}
          </div>
          <p className="cap" style={{ marginTop: 10 }}>Tap a lift to see every set. Compared on weight first, then total reps.</p>
        </section>
      ) : null}

      {checkIn && (checkIn.feel || checkIn.pains.length || checkIn.notes) ? (
        <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="ln">Notes for your coach</p>
          {checkIn.feel || checkIn.pains.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {checkIn.feel ? <span className="tag neutral">{FEEL_LABEL[checkIn.feel as Feel] ?? checkIn.feel}</span> : null}
              {checkIn.pains.map((p) => <span key={p} className="tag neutral">Pain · {PAIN_LABEL[p as PainArea] ?? p}</span>)}
            </div>
          ) : null}
          {checkIn.notes ? <p style={{ whiteSpace: "pre-wrap", fontSize: 16 }}>{checkIn.notes}</p> : null}
        </div>
      ) : null}
    </main>
  );
}

function Row({ n, kg, reps, effort }: { n: number; kg: string; reps: string; effort: SetEffort | null }) {
  return (
    <>
      <span className="num" style={{ color: "var(--muted)" }}>{n}</span>
      <span className="num" style={{ textAlign: "right" }}>{kg}</span>
      <span className="num" style={{ textAlign: "right" }}>{reps}</span>
      <span style={{ textAlign: "right" }}>{effort ? <span className={`tag ${effort === "easy" ? "neutral" : "ember"}`}>{SET_EFFORT_LABEL[effort]}</span> : null}</span>
    </>
  );
}
