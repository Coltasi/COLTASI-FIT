import Link from "next/link";
import { CoachMark, PageHeader } from "@/components/ui";
import { liftChange } from "@/components/coach-plan";
import type { LiftSignal } from "@/lib/coach-signals";
import { IconBook, IconCheck, IconClock } from "@/components/icons";
import { getContext, getFinishers, getLastTimes, getProgram, getWeekState } from "@/lib/data";
import { daysBetween, fmtDow, mondayOf as week0 } from "@/lib/dates";
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
  const [last, finishers, { data: lastOfDay }, { data: reads }] = await Promise.all([
    getLastTimes(supabase, day ? day.exercises.map((e) => e.exercise_id) : []),
    getFinishers(supabase),
    day
      ? supabase.from("sessions").select("session_date").eq("day_id", day.id).eq("status", "done").order("session_date", { ascending: false }).limit(1)
      : Promise.resolve({ data: null }),
    supabase.from("coach_reads").select("signals").not("signals", "is", null).order("created_at", { ascending: false }).limit(15),
  ]);
  // The Coach's latest call per lift, shown next to the plan so a changed prescription is never a surprise.
  const calls = new Map<string, LiftSignal>();
  for (const r of (reads ?? []) as { signals: { lifts?: LiftSignal[] } | null }[]) for (const l of r.signals?.lifts ?? []) {
    const k = l.name.toLowerCase();
    if (!calls.has(k)) calls.set(k, l);
  }
  const totalSets = day ? day.exercises.reduce((s, e) => s + e.target_sets, 0) : 0;
  const suggested = !!day && day.id === week.nextDay?.id;

  // "This week" follows the workout picked with Change. A picked Kettlebell day, or a Split day already
  // done this week, has no to-do tile of its own, so it gets one.
  // On a break the Split waits: the only to-do tile is the next holiday workout.
  const todo = week.brk ? [] : split.filter((d) => !week.done.has(d.id));
  const todoTiles = day && (week.brk || !suggested) && !todo.some((d) => d.id === day.id) ? [day, ...todo] : todo;

  const lastAgo = lastOfDay?.[0] ? ago(daysBetween(lastOfDay[0].session_date, today)) : null;

  return (
    <main className="screen" style={{ gap: 26 }}>
      <PageHeader
        title="Train"
        sub={week.doneToday.length ? `${week.doneToday.map((x) => x.title).join(" + ")} completed today`
          : week.brk ? `Holiday mode: ${week.breakDone} of ${week.brk.workouts_per_week} this week`
          : `${week.doneThisWeek} ${week.doneThisWeek === 1 ? "workout" : "workouts"} this week`}
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Link prefetch={false} href="/train/library" className="iconbtn" aria-label="Exercise library"><IconBook /></Link>
            <Link prefetch={false} href="/train/history" className="iconbtn" aria-label="Workout history"><IconClock /></Link>
          </div>
        }
      />

      {sp.finished ? (
        <Link prefetch={false} href="/coach" className="card cream" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", color: "var(--navy)" }}>
          <CoachMark size={28} />
          <span className="ln" style={{ flexGrow: 1 }}>Workout saved. Your coach is reviewing it.</span>
        </Link>
      ) : null}

      {week.inProgress ? (
        <Link prefetch={false} href={`/train/session/${week.inProgress.id}`} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", border: "2px solid var(--rust)", color: "var(--navy)" }}>
          <div>
            <p className="lab" style={{ color: "var(--rust)" }}>In progress</p>
            <p className="ln" style={{ marginTop: 2 }}>{week.inProgress.title}</p>
          </div>
          <span className="btn small">Resume</span>
        </Link>
      ) : null}

      {day ? (
        <section className="feature">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <p className="eyebrow">{suggested ? (week.brk ? "Holiday mode" : week.doneToday.length ? "Next session" : "Today's session") : "Picked session"}</p>
            <Link prefetch={false} href="/train/choose" className="btn2" style={{ flexShrink: 0 }}>Change</Link>
          </div>
          <h2 className="feature-title" style={{ fontSize: 32 }}>{day.name}</h2>
          <p style={{ fontSize: 17 }}>{day.exercises.length} exercises · {totalSets} sets</p>
          <p style={{ fontSize: 16, color: "var(--on-navy-muted)" }}>{lastAgo ? `Last trained ${lastAgo}` : "First time on this day"}</p>
          {!suggested && week.nextDay ? (
            <p style={{ fontSize: 15, color: "var(--on-navy-muted)" }}>
              {week.brk ? `Suggested holiday workout is ${week.nextDay.name}.` : `Next in The Split is ${week.nextDay.name}.`} <Link prefetch={false} href="/train" className="pill" style={{ marginLeft: 6 }}>Switch back</Link>
            </p>
          ) : null}
        </section>
      ) : null}


      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="sec">This week</h2>
          <p className="cap"><span className="num" style={{ color: "var(--navy)" }}>{week.doneThisWeek}</span> {week.doneThisWeek === 1 ? "workout" : "workouts"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(5, weekDone.length + todoTiles.length)}, minmax(0, 1fr))`, gap: 6 }}>
          {weekDone.map((x) => (
            <Link prefetch={false} key={x.id} href={`/train/session/${x.id}`} className="card flat" style={{ ...tileBase, background: "var(--navy)", borderColor: "var(--navy)", color: "#fff" }}>
              <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>{x.session_date === today ? "Today" : fmtDow(x.session_date)}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{x.kind === "custom" ? "Custom" : x.kind === "kettlebell" ? "KB" : x.title}</span>
              <IconCheck size={14} />
            </Link>
          ))}
          {todoTiles.map((d) => {
            const isNext = day?.id === d.id;
            return (
              <Link prefetch={false} key={d.id} href={`/train?day=${d.id}`} className="card flat"
                style={{ ...tileBase, ...(isNext ? { border: "2px solid var(--ember)", color: "var(--rust)", background: "var(--tint-ember-soft)" } : {}) }}>
                <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>{isNext ? (week.doneToday.length ? "Next" : "Today") : "To do"}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{d.program === "kettlebell" ? "KB" : d.program === "holiday" ? (d.day_order === 1 ? "Hol A" : "Hol B") : d.name}</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", margin: "4px 0", background: isNext ? "var(--ember)" : "var(--line-strong)" }} />
              </Link>
            );
          })}
        </div>
      </div>

      {day ? (
        <StartForm
          dayId={day.id}
          dayName={day.name}
          units={units}
          finishers={finishers}
          lifts={day.exercises.map((e) => {
            const call = calls.get(e.name.toLowerCase());
            const c = call ? liftChange(call, units) : null;
            return {
              key: `${e.position}:${e.exercise_id}`,
              position: e.position,
              name: e.name,
              plan: `${e.target_sets} sets × ${e.rep_range}${e.sub_for ? ` · in for ${e.sub_for.name}` : e.added ? " · added last time" : ""}`,
              lastKg: last.get(e.exercise_id)?.top ?? null,
              hasLast: last.has(e.exercise_id),
              coach: c ? { tone: c.tone, text: c.short } : null,
            };
          })}
          disabled={!!week.inProgress}
        />
      ) : (
        <p className="cap">No program found.</p>
      )}
    </main>
  );
}

const ago = (n: number) => (n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);

const tileBase = { borderRadius: 12, padding: "9px 2px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, color: "var(--navy)" };
