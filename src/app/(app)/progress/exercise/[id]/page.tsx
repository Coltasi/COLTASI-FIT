import { notFound } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { daysBetween, fmtMonth, fmtShort } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { getLiftHistory } from "@/lib/lifts";
import { LineChart } from "../../parts";

export default async function ExercisePage({ params }: PageProps<"/progress/exercise/[id]">) {
  const { id } = await params;
  const { supabase, units } = await getContext();
  const [{ data: ex }, [hist]] = await Promise.all([
    supabase.from("exercises").select("id, name, modality").eq("id", id).single(),
    getLiftHistory(supabase, id),
  ]);
  if (!ex) notFound();
  const sessions = hist?.sessions ?? [];
  const tops = sessions.filter((s) => s.top != null) as { date: string; top: number; sets: any[] }[];
  const best = tops.length ? Math.max(...tops.map((s) => s.top)) : null;
  const first = tops[0]?.top ?? null;
  let runningBest = -Infinity;
  const prDates = new Set<string>();
  for (const s of tops) if (s.top > runningBest) { if (runningBest !== -Infinity) prDates.add(s.date); runningBest = s.top; }
  const x0 = tops[0]?.date;

  return (
    <main className="screen">
      <BackHeader href="/progress/lifting" label="Lifting" eyebrow={ex.modality} title={ex.name} />

      <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div style={{ padding: "14px 12px" }}><div className="num" style={{ fontSize: 22 }}>{best != null ? w(best, units) : "–"}<span style={{ fontSize: 13 }}> {unit(units)}</span></div><p className="cap">Best</p></div>
        <div style={{ padding: "14px 12px", borderLeft: "1px solid var(--line-soft)" }}><div className="num" style={{ fontSize: 22 }}>{first != null ? w(first, units) : "–"}<span style={{ fontSize: 13 }}> {unit(units)}</span></div><p className="cap">First logged</p></div>
        <div style={{ padding: "14px 12px", borderLeft: "1px solid var(--line-soft)" }}>
          <div className="num" style={{ fontSize: 22, color: "var(--kingfisher-text)" }}>{best != null && first ? `${Math.round((best / first) * 10) / 10}×` : "–"}</div>
          <p className="cap">Load gained</p>
        </div>
      </div>

      {tops.length > 1 ? (
        <div className="card" style={{ padding: "16px 16px 12px" }}>
          <p className="lab" style={{ marginBottom: 10 }}>Top set weight</p>
          <LineChart
            ariaLabel={`Top set weight from ${w(first, units)} to ${w(tops.at(-1)!.top, units)} ${unit(units)}`}
            unitLabel={unit(units)}
            points={tops.map((s) => ({ x: daysBetween(x0!, s.date), y: Number(w(s.top, units)) }))}
            markers={tops.map((s) => ({ x: daysBetween(x0!, s.date), y: Number(w(s.top, units)), kind: s.top === best && s === tops.at(-1) ? "accent" as const : "big" as const }))}
            height={140}
            xLabels={[...new Set(tops.map((s) => fmtMonth(s.date)))]}
          />
        </div>
      ) : null}

      <div className="card clip">
        <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr) 64px", gap: 8, padding: "12px 16px 6px" }}>
          <span className="lab">Date</span><span className="lab">Reps</span><span className="lab" style={{ textAlign: "right" }}>{unit(units)}</span>
        </div>
        {[...sessions].reverse().map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr) 64px", gap: 8, alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--line-soft)" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtShort(s.date)}</span>
            <span className="cap">
              {s.sets.map((z) => z.reps ?? "?").join(", ")}
              {prDates.has(s.date) ? <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", padding: "2px 6px", borderRadius: 6, background: "var(--tint-ember)", color: "var(--rust)", marginLeft: 6 }}>PR</span> : null}
            </span>
            <span className="num" style={{ fontSize: 16, textAlign: "right" }}>{s.top != null ? w(s.top, units) : "–"}</span>
          </div>
        ))}
        {!sessions.length ? <p className="cap" style={{ padding: "8px 16px 14px" }}>Not logged yet.</p> : null}
      </div>
    </main>
  );
}
