import { BackHeader } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { fmtLong } from "@/lib/dates";
import { unit, w, type Units } from "@/lib/units";

/** Read-only view of a finished (or skipped) session: every logged set per lift. */
export function LoggedView({ title, date, status, units, lifts }: {
  title: string; date: string; status: string; units: Units;
  lifts: { id: string; name: string; sets: { weight_kg: number | null; reps: number | null }[] }[];
}) {
  const logged = lifts.filter((l) => l.sets.length);
  return (
    <main className="screen">
      <BackHeader href="/train/history" label="History" eyebrow={`Logged · ${fmtLong(date)}`} title={title} />
      {status === "skipped" ? <p className="cap">This session was skipped. Nothing was logged.</p> : null}
      {status !== "skipped" && !logged.length ? <p className="cap">No sets were ticked in this session.</p> : null}
      {logged.map((l) => (
        <div key={l.id} className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCheck size={14} /></span>
            <p className="ln" style={{ flexGrow: 1 }}>{l.name}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) minmax(0,1fr)", gap: "6px 8px", fontSize: 14 }}>
            <span className="lab" style={{ fontSize: 10 }}>Set</span>
            <span className="lab" style={{ fontSize: 10 }}>{unit(units)}</span>
            <span className="lab" style={{ fontSize: 10 }}>Reps</span>
            {l.sets.map((z, i) => (
              <Row key={i} n={i + 1} kg={z.weight_kg ? w(z.weight_kg, units) : "BW"} reps={z.reps == null ? "?" : String(z.reps)} />
            ))}
          </div>
        </div>
      ))}
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
