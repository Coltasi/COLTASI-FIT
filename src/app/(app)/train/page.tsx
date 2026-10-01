import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { IconCheck, IconClock } from "@/components/icons";
import { getContext, getLastTimes, getProgram, getWeekState } from "@/lib/data";
import { fmtDay, fmtDow, fmtShort } from "@/lib/dates";
import { StartForm } from "./start-form";

export default async function TrainPage({ searchParams }: PageProps<"/train">) {
  const sp = await searchParams;
  const { supabase, today, units } = await getContext();
  const programP = getProgram(supabase);
  const [program, week] = await Promise.all([programP, getWeekState(supabase, today, programP)]);
  const split = program.filter((d) => d.program === "split");
  const chosenId = typeof sp.day === "string" ? sp.day : undefined;
  const day = program.find((d) => d.id === chosenId) ?? week.nextDay;
  const [last, { data: lastOfDay }] = await Promise.all([
    getLastTimes(supabase, day ? day.exercises.map((e) => e.exercise_id) : []),
    day
      ? supabase.from("sessions").select("session_date").eq("day_id", day.id).eq("status", "done").order("session_date", { ascending: false }).limit(1)
      : Promise.resolve({ data: null }),
  ]);
  const totalSets = day ? day.exercises.reduce((s, e) => s + e.target_sets, 0) : 0;
  const doneCount = split.filter((d) => week.done.has(d.id)).length;

  return (
    <main className="screen">
      <BrandRow />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="disp" style={{ fontSize: 30 }}>Train</h1>
        <Link href="/train/history" className="iconbtn" aria-label="Session history"><IconClock /></Link>
      </div>

      {sp.finished ? (
        <Link href="/coach" className="card cream" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", color: "var(--navy)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/coltasi-bird.svg" alt="" width={26} height={26} />
          <span className="ln" style={{ flexGrow: 1 }}>Session saved. Coach is writing your read.</span>
        </Link>
      ) : null}

      {week.inProgress ? (
        <Link href={`/train/session/${week.inProgress.id}`} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", border: "2px solid var(--ember)", color: "var(--navy)" }}>
          <div>
            <p className="lab" style={{ color: "var(--rust)" }}>In progress</p>
            <p className="ln" style={{ marginTop: 2 }}>{week.inProgress.title}</p>
          </div>
          <span className="btn small">Resume</span>
        </Link>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">This week · The Split</p>
          <p className="cap"><span className="num" style={{ color: "var(--navy)" }}>{doneCount}</span> of {split.length} done</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${split.length || 5}, minmax(0, 1fr))`, gap: 6 }}>
          {split.map((d) => {
            const doneOn = week.done.get(d.id);
            const isNext = !doneOn && week.nextDay?.id === d.id;
            const style = doneOn
              ? { background: "var(--navy)", borderColor: "var(--navy)", color: "#fff" }
              : isNext
                ? { border: "2px solid var(--ember)", color: "var(--rust)", background: "var(--tint-ember-soft)" }
                : {};
            return (
              <Link key={d.id} href={`/train?day=${d.id}`} className="card flat" style={{ borderRadius: 12, padding: "9px 2px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: "var(--navy)", ...style }}>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{doneOn ? fmtDow(doneOn) : isNext ? "Today" : "Next"}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{d.name}</span>
                {doneOn ? <IconCheck size={14} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", margin: "4px 0", background: isNext ? "var(--ember)" : "var(--line-strong)" }} />}
              </Link>
            );
          })}
        </div>
      </div>

      {day ? (
        <>
          <div className="card" style={{ padding: "18px 18px 16px" }}>
            <p className="lab" style={{ color: "var(--rust)" }}>{day.id === week.nextDay?.id ? `Today · ${fmtDay(today)}` : fmtDay(today)}</p>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
              <h2 className="disp" style={{ fontSize: 40, lineHeight: 1 }}>{day.name}</h2>
              <Link href="/train/choose" style={{ fontSize: 14, fontWeight: 600, padding: "10px 0 4px 12px" }}>Change</Link>
            </div>
            <p className="cap" style={{ marginTop: 8 }}>
              {day.program === "split" ? "The Split" : "Kettlebell"} · {day.exercises.length} lifts · {totalSets} sets
              {lastOfDay?.[0] ? ` · last done ${fmtShort(lastOfDay[0].session_date)}` : ""}
            </p>
          </div>
          <StartForm
            dayId={day.id}
            dayName={day.name}
            units={units}
            lifts={day.exercises.map((e) => ({
              key: e.exercise_id,
              name: e.name,
              plan: `${e.target_sets} × ${e.rep_range}`,
              lastKg: last.get(e.exercise_id)?.top ?? null,
            }))}
            disabled={!!week.inProgress}
          />
        </>
      ) : (
        <p className="cap">No program found.</p>
      )}
    </main>
  );
}
