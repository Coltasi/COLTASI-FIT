import { BackHeader } from "@/components/ui";
import { IconCheck, IconPen } from "@/components/icons";
import { reopenSession } from "../../actions";
import { fmtLong } from "@/lib/dates";
import { unit, w, type Units } from "@/lib/units";
import { SKIP_LABEL, type SkipReason } from "@/lib/owed";
import { EffortCard } from "@/components/effort";
import type { Verdict } from "@/lib/effort";
import { FEEL_LABEL, PAIN_LABEL, type Feel, type PainArea } from "@/lib/check-in";

/** Read-only view of a finished (or skipped) session: every logged set per lift. */
export function LoggedView({ id, saved, title, date, status, units, lifts, checkIn, verdict }: {
  id: string; saved?: boolean; title: string; date: string; status: string; units: Units;
  checkIn?: { feel: string | null; pains: string[]; notes: string | null; effort?: string | null };
  verdict?: Verdict | null;
  lifts: { id: string; name: string; skipped: string | null; skill: boolean; sets: { weight_kg: number | null; reps: number | null }[] }[];
}) {
  const logged = lifts.filter((l) => l.sets.length);
  const skipped = lifts.filter((l) => !l.sets.length && l.skipped);
  const missed = lifts.filter((l) => !l.sets.length && !l.skipped);
  return (
    <main className="screen">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <BackHeader href="/train/history" label="History" eyebrow={`Logged · ${fmtLong(date)}`} title={title} />
        {status === "done" ? (
          <form action={reopenSession.bind(null, id)}>
            <button type="submit" className="btn2" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <IconPen size={14} />Edit
            </button>
          </form>
        ) : null}
      </div>
      {saved ? <p className="cap" style={{ color: "var(--rust)", fontWeight: 600 }}>Changes saved. Coach will re-read this workout.</p> : null}
      {status === "skipped" ? <p className="cap">This session was skipped. Nothing was logged.</p> : null}
      {status === "done" ? <EffortCard self={checkIn?.effort ?? null} verdict={verdict ?? null} feel={checkIn?.feel ?? null} /> : null}
      {status !== "skipped" && !logged.length ? <p className="cap">No sets were ticked in this session.</p> : null}
      {logged.map((l) => (
        <div key={l.id} className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCheck size={14} /></span>
            <p className="ln" style={{ flexGrow: 1 }}>{l.name}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) minmax(0,1fr)", gap: "6px 8px", fontSize: 14 }}>
            <span className="lab" style={{ fontSize: 10 }}>Set</span>
            <span className="lab" style={{ fontSize: 10 }}>{l.skill ? "" : unit(units)}</span>
            <span className="lab" style={{ fontSize: 10 }}>{l.skill ? "Secs" : "Reps"}</span>
            {l.sets.map((z, i) => (
              <Row key={i} n={i + 1} kg={l.skill ? "" : z.weight_kg ? w(z.weight_kg, units) : "BW"} reps={z.reps == null ? "?" : String(z.reps)} />
            ))}
          </div>
        </div>
      ))}
      {checkIn && (checkIn.feel || checkIn.pains.length || checkIn.notes) ? (
        <div className="card cream" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <p className="lab" style={{ color: "var(--navy)" }}>Notes for Coach</p>
          {checkIn.feel || checkIn.pains.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {checkIn.feel ? <span className="tag neutral">{FEEL_LABEL[checkIn.feel as Feel] ?? checkIn.feel}</span> : null}
              {checkIn.pains.map((p) => <span key={p} className="tag neutral">Pain · {PAIN_LABEL[p as PainArea] ?? p}</span>)}
            </div>
          ) : null}
          {checkIn.notes ? <p className="cap" style={{ whiteSpace: "pre-wrap", color: "var(--navy)" }}>{checkIn.notes}</p> : null}
        </div>
      ) : null}
      {missed.length ? (
        <div className="card clip" style={{ borderStyle: "dashed" }}>
          {missed.map((l) => (
            <div key={l.id} className="row">
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px solid var(--mist)", flexShrink: 0 }} />
              <p className="ln" style={{ flexGrow: 1, color: "var(--muted)" }}>{l.name}</p>
              <span className="tag neutral">Not logged</span>
            </div>
          ))}
        </div>
      ) : null}
      {skipped.length ? (
        <div className="card clip">
          {skipped.map((l) => (
            <div key={l.id} className="row">
              <p className="ln" style={{ flexGrow: 1, color: "var(--muted)" }}>{l.name}</p>
              <span className="tag neutral">Skipped{l.skipped && SKIP_LABEL[l.skipped as SkipReason] ? ` · ${SKIP_LABEL[l.skipped as SkipReason]}` : ""}</span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}

function Row({ n, kg, reps }: { n: number; kg: string; reps: string }) {
  return (
    <>
      <span className="num" style={{ color: "var(--muted)" }}>{n}</span>
      <span className="num">{kg}</span>
      <span className="num">{reps}</span>
    </>
  );
}
