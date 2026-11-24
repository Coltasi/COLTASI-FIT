import Link from "next/link";
import type { ReactNode } from "react";
import { BrandRow, CoachMark } from "@/components/ui";
import { InstallCard } from "@/components/install-card";
import { CoachRead } from "@/components/coach-read";
import { IconChevron, IconGear } from "@/components/icons";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { addDays, fmtLong } from "@/lib/dates";
import { startSession } from "./train/actions";
import { SleepCard } from "./sleep-card";
import { StepsCard } from "./steps-card";
import { WorkoutCalendar, type CalSession } from "./workout-calendar";
import { getSteps, stepSummary } from "@/lib/steps";
import { getOwed, owedFor, SKIP_LABEL } from "@/lib/owed";
import { IntakeBars } from "./food/bars";
import { EffortTag } from "@/components/effort";
import { effortCallout, gradeSession } from "@/lib/effort";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Today: the Coach's note and today's workout in one card, then quick check-ins and the week. */
export default async function OverviewPage() {
  const { supabase, today, units, profile } = await getContext();
  const programP = getProgram(supabase);
  // The week strip runs Sunday to Saturday.
  const sunday = addDays(today, -new Date(today + "T12:00:00Z").getUTCDay());
  const [week, { data: read }, { data: sleeps }, stepRows, { data: weekSessions }, owedAll, { data: calRows }, { data: foodRows }] = await Promise.all([
    getWeekState(supabase, today, programP),
    supabase.from("coach_reads").select("kind, source_id, headline, next_session, lifting, weight, recovery, signals").order("created_at", { ascending: false }).limit(1),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags, note").gte("night_of", addDays(today, -7)).order("night_of"),
    getSteps(supabase, today, 14),
    supabase.from("sessions").select("session_date").eq("status", "done").gte("session_date", sunday),
    getOwed(supabase, today),
    supabase.from("sessions").select("id, session_date, kind, title").eq("status", "done").gte("session_date", addDays(today, -400)).order("session_date"),
    supabase.from("food_logs").select("kcal, protein_g").eq("day", today),
  ]);
  const foodKcal = ((foodRows ?? []) as any[]).reduce((s, r) => s + Number(r.kcal), 0);
  const foodProtein = ((foodRows ?? []) as any[]).reduce((s, r) => s + Number(r.protein_g), 0);
  const calSessions: CalSession[] = ((calRows ?? []) as { id: string; session_date: string; kind: string; title: string }[])
    .map((r) => ({ id: r.id, date: r.session_date, kind: r.kind, title: r.title }));
  const stepByDay = new Map(stepRows.map((r) => [r.day, r.steps]));
  const stepAvg = stepSummary(stepRows, today).avg7;
  const night = addDays(today, -1);
  const lastNight = ((sleeps ?? []) as any[]).find((s) => s.night_of === night);
  const byNight = new Map(((sleeps ?? []) as any[]).map((s) => [s.night_of, Number(s.hours)]));
  const latest = read?.[0];
  const day = week.nextDay;
  const weekCount = (weekSessions ?? []).length;
  const trainedOn = new Set(((weekSessions ?? []) as any[]).map((s) => s.session_date as string));

  // A finished session today (custom or kettlebell included) counts as today's workout.
  const doneToday = !week.inProgress && week.doneToday.length ? week.doneToday : null;
  const label = (
    <p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}>
      <CoachMark />Coach
    </p>
  );

  // After a workout, the Coach grades it honestly from the logs, next to your own rating.
  let lead: ReactNode = null;
  if (latest?.kind === "session" && latest.source_id) {
    const { data: src } = await supabase.from("sessions").select("effort, feel, session_exercises(skipped_reason, skill)").eq("id", latest.source_id).maybeSingle();
    const skipped = ((src?.session_exercises ?? []) as any[]).filter((x) => x.skipped_reason && !x.skill).length;
    const v = gradeSession((latest.signals as any)?.lifts, skipped);
    if (v) {
      const callout = effortCallout((src?.effort as any) ?? null, v, src?.feel ?? null);
      lead = (
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            Last workout <EffortTag grade={v.grade} />
          </span>
          <span className="cap" style={{ fontSize: 14, color: "var(--navy)", fontWeight: 400 }}>{v.line}{callout ? ` ${callout}` : ""}</span>
        </span>
      );
    }
  }

  const action = week.inProgress ? (
    <Link href={`/train/session/${week.inProgress.id}`} className="btn" style={{ height: 50, gap: 8, boxShadow: "none" }}>
      Resume {week.inProgress.title}<IconChevron stroke="currentColor" />
    </Link>
  ) : doneToday ? (
    <Link href={`/train/session/${doneToday[doneToday.length - 1].id}`} className="btn2" style={{ height: 46, gap: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
      View workout<IconChevron stroke="currentColor" />
    </Link>
  ) : day ? (
    <form action={startSession}>
      <input type="hidden" name="day_id" value={day.id} />
      <input type="hidden" name="quick" value="1" />
      <button type="submit" className="btn" style={{ height: 50, gap: 8, boxShadow: "none" }}>
        Start {day.name}<IconChevron stroke="currentColor" />
      </button>
    </form>
  ) : null;

  // Skipped lifts that suit the next workout: the Coach reminds you before you start.
  const owed = !week.inProgress && !doneToday && day ? owedFor(owedAll, day.name, day.exercises.map((x) => x.name)) : [];
  const owedNote = owed.length ? (
    <p style={{ fontSize: 15, lineHeight: 1.45, color: "var(--navy)" }}>
      {owed.length === 1
        ? `You still owe ${owed[0].name} from ${owed[0].from} (skipped, ${SKIP_LABEL[owed[0].reason]}). Fit it into ${day!.name} today: tap Add once you start.`
        : `You still owe ${owed.length} skipped lifts: ${owed.map((o) => o.name).join(", ")}. Add them once you start ${day!.name}.`}
    </p>
  ) : null;

  const footer = action || owedNote ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 10px" }}>
      {owedNote}
      {action}
    </div>
  ) : null;

  return (
    <main className="screen" style={{ gap: 26 }}>
      <BrandRow right={<Link href="/settings" className="iconbtn" aria-label="Settings"><IconGear /></Link>} />
      <h1 className="disp" style={{ fontSize: 30, lineHeight: 1.1 }}>{fmtLong(today)}</h1>

      <InstallCard />

      {latest ? (
        <CoachRead collapsible padding="18px 18px 8px" read={latest} units={units} label={label} lead={lead} footer={footer} />
      ) : (
        <div className="card cream" style={{ padding: "18px 18px 8px" }}>
          {label}
          <p style={{ fontSize: 15, lineHeight: 1.45, margin: "8px 0 0" }}>Your Coach&apos;s first note shows up after your first session.</p>
          {footer}
        </div>
      )}

      <Link href="/food" className="card" style={{ padding: "18px 18px", display: "grid", gap: 14, color: "var(--navy)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">Food today</p>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ember-text)" }}>{foodRows?.length ? "Add" : "Log food"} →</span>
        </div>
        <IntakeBars kcal={foodKcal} protein={foodProtein} targetKcal={profile.target_kcal ?? null} targetProtein={profile.protein_g ?? null} />
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14 }}>
        <SleepCard
          key={lastNight ? `${lastNight.hours}-${lastNight.wake_feeling}` : "none"}
          night={night}
          logged={lastNight ? { hours: Number(lastNight.hours), wake_feeling: lastNight.wake_feeling, flags: lastNight.flags ?? [], note: lastNight.note } : null}
          bars={Array.from({ length: 7 }, (_, i) => { const n = addDays(today, i - 7); return { night: n, hours: byNight.get(n) ?? null }; })}
        />
        <StepsCard
          key={`${stepByDay.get(today) ?? "none"}-${stepByDay.get(addDays(today, -1)) ?? "none"}`}
          today={today}
          avg7={stepAvg}
          bars={Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { day: d, steps: stepByDay.get(d) ?? null }; })}
        />
      </div>

      <div className="card" style={{ padding: "18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">This week</p>
          <p className="cap" style={{ fontSize: 14 }}>{weekCount} {weekCount === 1 ? "workout" : "workouts"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6, marginTop: 12 }}>
          {DOW.map((d, i) => {
            const date = addDays(sunday, i);
            const done = trainedOn.has(date);
            const isToday = date === today;
            return (
              <Link key={date} href={`/train/history?day=${date}`} aria-label={`${date}${done ? ", trained" : ""}`} style={{ textAlign: "center", padding: "4px 0", color: "inherit" }}>
                <div style={{ height: 8, borderRadius: 4, background: done ? "var(--kingfisher)" : "var(--line-soft)", border: isToday && !done ? "1px dashed var(--ember)" : "none" }} />
                <p className="cap" style={{ fontSize: 14, marginTop: 4, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--navy)" : undefined }}>{d}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <WorkoutCalendar sessions={calSessions} today={today} />
    </main>
  );
}
