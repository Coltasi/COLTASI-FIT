import Link from "next/link";
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
import { IntakeBars, leftLine } from "./food/bars";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Today: the Coach's note and today's workout in one card, then quick check-ins and the week. */
export default async function OverviewPage() {
  const { supabase, today, units, profile } = await getContext();
  const programP = getProgram(supabase);
  // The week strip runs Sunday to Saturday.
  const sunday = addDays(today, -new Date(today + "T12:00:00Z").getUTCDay());
  const [week, { data: read }, { data: sleeps }, stepRows, { data: weekSessions }, owedAll, { data: calRows }, { data: foodRows }] = await Promise.all([
    getWeekState(supabase, today, programP),
    supabase.from("coach_reads").select("headline, next_session, lifting, weight, recovery, signals").order("created_at", { ascending: false }).limit(1),
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
  const title = week.inProgress?.title ?? (doneToday ? doneToday.map((s) => s.title).join(" + ") : day?.name ?? "Workout");
  const status = week.inProgress ? "In progress" : doneToday ? "Done" : null;

  const label = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}>
        <CoachMark />{doneToday ? "Done today" : "Today"} · {title}
      </p>
      {status ? <span className={`tag ${week.inProgress ? "ember" : "blue"}`}>{status}</span> : null}
    </div>
  );

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
    <p className="cap" style={{ fontSize: 13, lineHeight: 1.4, color: "var(--navy)" }}>
      {owed.length === 1
        ? `You still owe ${owed[0].name} from ${owed[0].from} (skipped, ${SKIP_LABEL[owed[0].reason]}). Fit it into ${day!.name} today: tap Add once you start.`
        : `You still owe ${owed.length} skipped lifts: ${owed.map((o) => o.name).join(", ")}. Add them once you start ${day!.name}.`}
    </p>
  ) : null;

  const footer = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 10px" }}>
      {owedNote}
      {action}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
        <Link href="/train">{doneToday || week.inProgress ? "Train" : "Pick another workout"}</Link>
        <Link href="/coach">Ask Coach</Link>
      </div>
    </div>
  );

  return (
    <main className="screen">
      <BrandRow right={<Link href="/settings" className="iconbtn" aria-label="Settings"><IconGear /></Link>} />
      <h1 className="disp" style={{ fontSize: 30, lineHeight: 1.1 }}>{fmtLong(today)}</h1>

      <InstallCard />

      {latest ? (
        <CoachRead padding="16px 16px 6px" read={latest} units={units} label={label} footer={footer} />
      ) : (
        <div className="card cream" style={{ padding: "16px 16px 6px" }}>
          {label}
          <p style={{ fontSize: 15, lineHeight: 1.45, margin: "8px 0 0" }}>Your Coach&apos;s first note shows up after your first session.</p>
          {footer}
        </div>
      )}

      <Link href="/food" className="card" style={{ padding: "12px 14px", display: "grid", gap: 8, color: "var(--navy)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">Food today</p>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--kingfisher-text)" }}>{foodRows?.length ? "Add" : "Log food"} →</span>
        </div>
        <IntakeBars compact kcal={foodKcal} protein={foodProtein} targetKcal={profile.target_kcal ?? null} targetProtein={profile.protein_g ?? null} />
        <p className="cap" style={{ fontSize: 12 }}>{leftLine(foodKcal, foodProtein, profile.target_kcal ?? null, profile.protein_g ?? null)}</p>
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
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

      <div className="card" style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">This week</p>
          <p className="cap" style={{ fontSize: 12 }}>{weekCount} {weekCount === 1 ? "workout" : "workouts"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 5, marginTop: 8 }}>
          {DOW.map((d, i) => {
            const date = addDays(sunday, i);
            const done = trainedOn.has(date);
            const isToday = date === today;
            return (
              <div key={date} style={{ textAlign: "center" }}>
                <div style={{ height: 8, borderRadius: 4, background: done ? "var(--kingfisher)" : "var(--line-soft)", border: isToday && !done ? "1px dashed var(--ember)" : "none" }} />
                <p className="cap" style={{ fontSize: 11, marginTop: 4, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--navy)" : undefined }}>{d}</p>
              </div>
            );
          })}
        </div>
      </div>

      <WorkoutCalendar sessions={calSessions} today={today} />
    </main>
  );
}
