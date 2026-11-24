import { notFound } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { fmtShort } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { getLiftHistory } from "@/lib/lifts";
import { LiftChart } from "./lift-chart";
import { liftChange } from "@/components/coach-plan";
import type { LiftSignal } from "@/lib/coach-signals";

export default async function ExercisePage({ params, searchParams }: PageProps<"/progress/exercise/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const fromOverview = sp.from === "overview";
  const { supabase, units } = await getContext();
  const [{ data: ex }, [hist], { data: reads }] = await Promise.all([
    supabase.from("exercises").select("id, name, modality").eq("id", id).single(),
    getLiftHistory(supabase, id),
    supabase.from("coach_reads").select("signals, created_at").not("signals", "is", null).order("created_at", { ascending: false }).limit(15),
  ]);
  if (!ex) notFound();
  const sessions = hist?.sessions ?? [];
  type Top = { date: string; top: number; sets: { weight_kg: number | null; reps: number | null }[] };
  const tops = sessions.filter((s) => s.top != null) as Top[];
  const best = tops.length ? Math.max(...tops.map((s) => s.top)) : null;
  const bestS = best != null ? tops.find((s) => s.top === best)! : null;
  const firstS = tops[0] ?? null;
  const latestS = sessions.at(-1) ?? null;
  let runningBest = -Infinity;
  const prDates = new Set<string>();
  for (const s of tops) if (s.top > runningBest) { if (runningBest !== -Infinity) prDates.add(s.date); runningBest = s.top; }
  // Logged, but never with a weight: a bodyweight lift. Progress there is reps, not load.
  const bw = best == null && sessions.length > 0;
  const repsOf = (s: { sets: { reps: number | null }[] }) => s.sets.reduce((n, z) => n + (z.reps ?? 0), 0);
  const bestReps = sessions.length ? Math.max(...sessions.map((s) => Math.max(0, ...s.sets.map((z) => z.reps ?? 0)))) : null;

  // Estimated one-rep max (Epley) from the heaviest set of 1 to 12 reps. Labelled an estimate, loaded lifts only.
  let e1rm: number | null = null;
  for (const s of tops) for (const z of s.sets) {
    const kgv = Number(z.weight_kg), r = z.reps ?? 0;
    if (kgv > 0 && r >= 1 && r <= 12) e1rm = Math.max(e1rm ?? 0, kgv * (1 + r / 30));
  }

  // The Coach's latest call on this lift, matched by name.
  let call: LiftSignal | null = null;
  for (const r of (reads ?? []) as { signals: { lifts?: LiftSignal[] } | null }[]) {
    call = r.signals?.lifts?.find((l) => l.name.toLowerCase() === ex.name.toLowerCase()) ?? null;
    if (call) break;
  }
  const change = call ? liftChange(call, units) : null;
  const u = unit(units);

  return (
    <main className="screen" style={{ gap: 22 }}>
      <BackHeader href={fromOverview ? "/" : "/progress/lifting"} label={fromOverview ? "Today" : "Strength"} eyebrow="Exercise analytics" title={ex.name} />

      {!sessions.length ? (
        <div className="card" style={{ padding: 18 }}>
          <p className="ln">Not logged yet</p>
          <p className="cap" style={{ marginTop: 4 }}>Log this lift in a workout and its history starts here.</p>
        </div>
      ) : (
        <section className="feature">
          <p className="eyebrow">{bw ? "Bodyweight · best set" : `Recorded best · ${fmtShort(bestS!.date)}`}</p>
          <p className="feature-title" style={{ fontSize: 36 }}>{bw ? `${bestReps} reps` : `${w(best!, units)} ${u}`}</p>
          <p style={{ fontSize: 16, color: "var(--on-navy-muted)" }}>
            {bw ? `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} logged. Progress here is reps, not weight.`
              : firstS && firstS.date !== bestS!.date ? `First logged at ${w(firstS.top, units)} ${u} on ${fmtShort(firstS.date)}` : "Your first logged session"}
          </p>
        </section>
      )}

      {sessions.length ? (
        <div className="tiles" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
          <div className="tile" style={{ padding: "14px 12px" }}>
            <span className="lab">Latest</span>
            <span className="big" style={{ fontSize: 24 }}>{bw ? `${Math.max(0, ...latestS!.sets.map((z) => z.reps ?? 0))}` : latestS?.top != null ? w(latestS.top, units) : "–"}</span>
            <span className="cap">{bw ? "best reps" : u} · {fmtShort(latestS!.date)}</span>
          </div>
          <div className="tile" style={{ padding: "14px 12px" }}>
            <span className="lab">{bw ? "Total reps" : "Est. max"}</span>
            <span className="big" style={{ fontSize: 24 }}>{bw ? repsOf(latestS!) : e1rm ? w(Math.round(e1rm * 2) / 2, units) : "–"}</span>
            <span className="cap">{bw ? "last session" : "1 rep, estimate"}</span>
          </div>
          <div className="tile" style={{ padding: "14px 12px" }}>
            <span className="lab">Sessions</span>
            <span className="big" style={{ fontSize: 24 }}>{sessions.length}</span>
            <span className="cap">{prDates.size} {prDates.size === 1 ? "new best" : "new bests"}</span>
          </div>
        </div>
      ) : null}

      {call ? (
        <div className="card cream" style={{ padding: "14px 16px", display: "flex", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/coltasi-bird.svg" alt="" width={28} height={28} style={{ flexShrink: 0 }} />
          <div>
            <p className="ln">Coach: {change ? change.text : "repeat last time's weight"}</p>
            <p style={{ fontSize: 15, lineHeight: 1.45, marginTop: 4 }}>{call.line}</p>
          </div>
        </div>
      ) : null}

      {tops.length > 1 ? (
        <LiftChart units={units} points={tops.map((s) => ({ date: s.date, top: s.top, reps: s.sets.map((z) => z.reps), pr: prDates.has(s.date) }))} />
      ) : null}
      {sessions.length && sessions.length < 3 ? (
        <p className="cap">Only {sessions.length} {sessions.length === 1 ? "session" : "sessions"} so far. A trend means more after a few more.</p>
      ) : null}

      {sessions.length ? (
        <section>
          <h2 className="sec" style={{ marginBottom: 4 }}>Session history</h2>
          <div style={{ display: "grid", gridTemplateColumns: "76px minmax(0,1fr) 70px", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line-strong)" }}>
            <span className="lab">Date</span><span className="lab">Reps per set</span><span className="lab" style={{ textAlign: "right" }}>{bw ? "Total" : `Top ${u}`}</span>
          </div>
          {[...sessions].reverse().map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "76px minmax(0,1fr) 70px", gap: 8, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line-strong)" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtShort(s.date)}</span>
              <span style={{ fontSize: 15, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {s.sets.map((z) => z.reps ?? "?").join(", ")}
                {prDates.has(s.date) ? <span className="tag jade" style={{ marginLeft: 8 }}>New best</span> : null}
              </span>
              <span className="num" style={{ fontSize: 17, textAlign: "right" }}>{bw ? repsOf(s) : s.top != null ? w(s.top, units) : "–"}</span>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
