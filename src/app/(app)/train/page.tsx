import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { IconBook, IconCheck, IconClock } from "@/components/icons";
import { getContext, getFinishers, getLastTimes, getProgram, getWeekState } from "@/lib/data";
import { daysBetween, fmtDay, fmtDow, fmtShort, mondayOf as week0 } from "@/lib/dates";
import { StartForm } from "./start-form";

export default async function TrainPage({ searchParams }: PageProps<"/train">) {
  const sp = await searchParams;
  const { supabase, today, units } = await getContext();
  const programP = getProgram(supabase);
  const [program, week, { data: weekRows }] = await Promise.all([
    programP,
    getWeekState(supabase, today, programP),
    supabase.from("sessions").select("id, title, kind, session_date, started_at").eq("status", "done").gte("session_date", week0(today)).order("session_date").order("started_at"),
  ]);
  // Every workout done this week, in order (split, custom and kettlebell alike), then the Split days still to do.
  const weekDone = (weekRows ?? []) as { id: string; title: string; kind: string; session_date: string }[];
  const split = program.filter((d) => d.program === "split");
  const chosenId = typeof sp.day === "string" ? sp.day : undefined;
  const day = program.find((d) => d.id === chosenId) ?? week.nextDay;
  const [last, finishers, { data: lastOfDay }] = await Promise.all([
    getLastTimes(supabase, day ? day.exercises.map((e) => e.exercise_id) : []),
    getFinishers(supabase),
    day
      ? supabase.from("sessions").select("session_date").eq("day_id", day.id).eq("status", "done").order("session_date", { ascending: false }).limit(1)
      : Promise.resolve({ data: null }),
  ]);
  const totalSets = day ? day.exercises.reduce((s, e) => s + e.target_sets, 0) : 0;
  const suggested = !!day && day.id === week.nextDay?.id;

  return (
    <main className="screen">
      <BrandRow />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="disp" style={{ fontSize: 30 }}>Train</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/train/library" className="iconbtn" aria-label="Exercise library"><IconBook /></Link>
          <Link href="/train/history" className="iconbtn" aria-label="Session history"><IconClock /></Link>
        </div>
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

      {!week.inProgress && week.doneToday.length ? (
        <div className="card" style={{ padding: "4px 0" }}>
          <p className="lab" style={{ padding: "10px 16px 4px" }}>Done today</p>
          {week.doneToday.map((s) => (
            <Link key={s.id} href={`/train/session/${s.id}`} className="row" style={{ color: "var(--navy)" }}>
              <IconCheck size={16} />
              <span className="ln" style={{ flexGrow: 1 }}>{s.title}</span>
              <span className="tag blue">Done</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">This week</p>
          <p className="cap"><span className="num" style={{ color: "var(--navy)" }}>{week.doneThisWeek}</span> {week.doneThisWeek === 1 ? "workout" : "workouts"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(5, weekDone.length + split.filter((d) => !week.done.has(d.id)).length)}, minmax(0, 1fr))`, gap: 6 }}>
          {weekDone.map((x) => (
            <Link key={x.id} href={`/train/session/${x.id}`} className="card flat" style={{ ...tileBase, background: "var(--navy)", borderColor: "var(--navy)", color: "#fff" }}>
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{x.session_date === today ? "Today" : fmtDow(x.session_date)}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{x.kind === "custom" ? "Custom" : x.kind === "kettlebell" ? "KB" : x.title}</span>
              <IconCheck size={14} />
            </Link>
          ))}
          {split.filter((d) => !week.done.has(d.id)).map((d) => {
            const isNext = week.nextDay?.id === d.id;
            return (
              <Link key={d.id} href={`/train?day=${d.id}`} className="card flat"
                style={{ ...tileBase, ...(isNext ? { border: "2px solid var(--ember)", color: "var(--rust)", background: "var(--tint-ember-soft)" } : {}) }}>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{isNext ? (week.doneToday.length ? "Next" : "Today") : "To do"}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{d.name}</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", margin: "4px 0", background: isNext ? "var(--ember)" : "var(--line-strong)" }} />
              </Link>
            );
          })}
        </div>
      </div>

      {day ? (
        <>
          <div className="card" style={{ padding: "18px 18px 16px" }}>
            <p className="lab" style={{ color: "var(--rust)" }}>{day.id === week.nextDay?.id ? (week.doneToday.length ? "Up next in The Split" : `Today · ${fmtDay(today)}`) : fmtDay(today)}</p>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
              <h2 className="disp" style={{ fontSize: 40, lineHeight: 1 }}>{day.name}</h2>
              <Link href="/train/choose" style={{ fontSize: 14, fontWeight: 600, padding: "10px 0 4px 12px" }}>Change</Link>
            </div>
            <p className="cap" style={{ marginTop: 8 }}>
              {day.program === "split" ? "The Split" : "Kettlebell"} · {day.exercises.length} lifts · {totalSets} sets
              {lastOfDay?.[0] ? ` · last done ${fmtShort(lastOfDay[0].session_date)}` : ""}
            </p>
            {suggested ? (
              <p style={{ fontSize: 13, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/coltasi-bird.svg" alt="" width={18} height={18} style={{ flexShrink: 0 }} />
                <span>
                  Suggested: next in The Split{lastOfDay?.[0] ? `, last done ${ago(daysBetween(lastOfDay[0].session_date, today))}` : ""}.
                  {day.overridden ? " Includes your swaps from last time." : ""}
                </span>
              </p>
            ) : week.nextDay ? (
              <p className="cap" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
                Suggested today is {week.nextDay.name}. <Link href="/train" style={{ fontWeight: 600 }}>Switch back</Link>
              </p>
            ) : null}
          </div>
          <StartForm
            dayId={day.id}
            dayName={day.name}
            units={units}
            finishers={finishers}
            lifts={day.exercises.map((e) => ({
              key: `${e.position}:${e.exercise_id}`,
              position: e.position,
              name: e.name,
              plan: `${e.target_sets} × ${e.rep_range}${e.sub_for ? ` · swapped in for ${e.sub_for.name}` : e.added ? " · added last time" : ""}`,
              undo: day.overridden && (e.sub_for || e.added) ? (e.sub_for ? `Undo swap, back to ${e.sub_for.name}` : "Remove from this day") : null,
              lastKg: last.get(e.exercise_id)?.top ?? null,
              hasLast: last.has(e.exercise_id),
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

const tileBase = { borderRadius: 12, padding: "9px 2px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, color: "var(--navy)" };

const ago = (n: number) => (n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);
