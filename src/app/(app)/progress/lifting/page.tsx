import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { getContext, getProgram } from "@/lib/data";
import { getLiftHistory, type ExHistory } from "@/lib/lifts";
import { fmtShort } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { ProgressTabs, Sparkline } from "../parts";

export default async function LiftingPage({ searchParams }: PageProps<"/progress/lifting">) {
  const sp = await searchParams;
  const { supabase, units } = await getContext();
  const [program, hist] = await Promise.all([getProgram(supabase), getLiftHistory(supabase)]);
  const dayOf = new Map<string, string>();
  for (const d of program) for (const e of d.exercises) if (!dayOf.has(e.exercise_id)) dayOf.set(e.exercise_id, d.program === "kettlebell" ? "Kettlebell" : d.name);
  const groupsOrder = [...program.filter((d) => d.program === "split").map((d) => d.name), "Kettlebell", "Other"];
  const filter = typeof sp.day === "string" && groupsOrder.includes(sp.day) ? sp.day : "All";

  const groups = new Map<string, ExHistory[]>();
  for (const h of hist) {
    const g = dayOf.get(h.exercise_id) ?? "Other";
    if (filter !== "All" && g !== filter) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(h);
  }
  const ordered = groupsOrder.filter((g) => groups.has(g));

  return (
    <main className="screen">
      <BrandRow />
      <h1 className="disp" style={{ fontSize: 30 }}>Progress</h1>
      <ProgressTabs active="lifting" />
      <div className="chips">
        {["All", ...groupsOrder.filter((g) => g !== "Other")].map((g) => (
          <Link key={g} href={g === "All" ? "/progress/lifting" : `/progress/lifting?day=${encodeURIComponent(g)}`} className={`chip${filter === g ? " on" : ""}`}>{g}</Link>
        ))}
      </div>

      {ordered.map((g) => (
        <div key={g} className="card clip">
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px 8px" }}><p className="lab">{g}</p><p className="lab">Best</p></div>
          {groups.get(g)!.map((h, i) => {
            const tops = h.sessions.map((s) => s.top).filter((x): x is number => x != null);
            const best = tops.length ? Math.max(...tops) : null;
            const bestDate = best != null ? [...h.sessions].reverse().find((s) => s.top === best)?.date : h.sessions.at(-1)?.date;
            const firstTop = tops[0];
            return (
              <Link key={h.exercise_id} href={`/progress/exercise/${h.exercise_id}`} className="row" style={i === 0 ? { paddingTop: 6 } : undefined}>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <p className="ln">{h.name}</p>
                  <p className="cap">{bestDate ? fmtShort(bestDate) : ""}{firstTop != null && best != null && best !== firstTop ? ` · from ${w(firstTop, units)} ${unit(units)}` : ""}</p>
                </div>
                <Sparkline values={tops.slice(-8)} />
                <div style={{ textAlign: "right", width: 64, flexShrink: 0 }}>
                  {best != null ? <><span className="num" style={{ fontSize: 17 }}>{w(best, units)}</span> <span className="cap">{unit(units)}</span></> : <span className="cap">{h.sessions.length}×</span>}
                </div>
              </Link>
            );
          })}
        </div>
      ))}
      {!ordered.length ? <p className="cap" style={{ textAlign: "center", marginTop: 24 }}>Finish a session and your lifts show up here.</p> : null}
    </main>
  );
}
