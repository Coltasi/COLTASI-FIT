import Link from "next/link";
import { PageHeader, Section } from "@/components/ui";
import { getContext, getProgram } from "@/lib/data";
import { getLiftHistory, type ExHistory } from "@/lib/lifts";
import { fmtShort } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { ProgressTabs, Sparkline } from "../parts";
import { SessionCounts } from "../session-counts";

export default async function LiftingPage({ searchParams }: PageProps<"/progress/lifting">) {
  const sp = await searchParams;
  const { supabase, units, today } = await getContext();
  const [program, hist] = await Promise.all([getProgram(supabase), getLiftHistory(supabase)]);
  const dayOf = new Map<string, string>();
  for (const d of program) for (const e of d.exercises) if (!dayOf.has(e.exercise_id)) dayOf.set(e.exercise_id, d.program === "split" ? d.name : "Kettlebell");
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

  // A PR is the heaviest top set ever. Most recent new best first (moved here from the home screen).
  const prs = hist
    .map((h) => {
      let best = -Infinity, bestDate = "";
      for (const x of h.sessions) if (x.top != null && x.top > best) { best = x.top; bestDate = x.date; }
      return { id: h.exercise_id, name: h.name, best, bestDate };
    })
    .filter((p) => p.bestDate)
    .sort((a, b) => (a.bestDate < b.bestDate ? 1 : a.bestDate > b.bestDate ? -1 : 0))
    .slice(0, 3);

  const latestPr = prs[0];
  const latestPrHist = latestPr ? hist.find((h) => h.exercise_id === latestPr.id) : null;
  const prFirst = latestPrHist?.sessions.map((x) => x.top).find((x): x is number => x != null);

  return (
    <main className="screen" style={{ gap: 22 }}>
      <PageHeader title="Progress" />
      <ProgressTabs active="lifting" />
      <SessionCounts supabase={supabase} today={today} />

      {filter === "All" && latestPr ? (
        <Link prefetch={false} href={`/progress/exercise/${latestPr.id}`} className="feature" style={{ color: "var(--on-navy)" }}>
          <p className="eyebrow">Latest recorded best · {fmtShort(latestPr.bestDate)}</p>
          <p className="feature-title">{latestPr.name} · {w(latestPr.best, units)} {unit(units)}</p>
          {prFirst != null && prFirst !== latestPr.best ? <p style={{ fontSize: 16, color: "var(--on-navy-muted)" }}>First logged at {w(prFirst, units)} {unit(units)}</p> : null}
          {prs.length > 1 ? (
            <p style={{ fontSize: 15, color: "var(--on-navy-muted)" }}>Also recent: {prs.slice(1).map((p) => `${p.name} ${w(p.best, units)} ${unit(units)}`).join(", ")}</p>
          ) : null}
        </Link>
      ) : null}

      <Section title="Exercise progression" gap={10}>
        <div className="chips">
          {["All", ...groupsOrder.filter((g) => g !== "Other")].map((g) => (
            <Link prefetch={false} key={g} href={g === "All" ? "/progress/lifting" : `/progress/lifting?day=${encodeURIComponent(g)}`} className={`chip${filter === g ? " on" : ""}`}>{g}</Link>
          ))}
        </div>
      </Section>

      {ordered.map((g) => (
        <section key={g}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 className="ln" style={{ fontSize: 17 }}>{g}</h3>
            <span className="cap">Best top set</span>
          </div>
          <div className="list">
            {groups.get(g)!.map((h) => {
              const tops = h.sessions.map((s) => s.top).filter((x): x is number => x != null);
              const best = tops.length ? Math.max(...tops) : null;
              const lastS = h.sessions.at(-1);
              const latestTop = lastS?.top ?? null;
              const sub = best != null
                ? `Latest ${latestTop != null ? `${w(latestTop, units)} ${unit(units)}` : "–"}${lastS ? ` · ${fmtShort(lastS.date)}` : ""}`
                : `Bodyweight · ${h.sessions.length} ${h.sessions.length === 1 ? "session" : "sessions"}${lastS ? ` · ${fmtShort(lastS.date)}` : ""}`;
              return (
                <Link prefetch={false} key={h.exercise_id} href={`/progress/exercise/${h.exercise_id}`} className="li">
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <p className="t" style={{ fontSize: 16 }}>{h.name}</p>
                    <p className="s">{sub}</p>
                  </div>
                  {tops.length >= 3 ? <Sparkline values={tops.slice(-8)} width={64} height={28} /> : <span className="cap" style={{ width: 64, textAlign: "center", flexShrink: 0 }}>{tops.length ? "Early" : ""}</span>}
                  <p className="v" style={{ minWidth: 70 }}>{best != null ? `${w(best, units)} ${unit(units)}` : `${h.sessions.length}×`}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      {!ordered.length ? <p className="cap" style={{ textAlign: "center", marginTop: 24 }}>Finish a session and your lifts show up here.</p> : null}
    </main>
  );
}
