import Link from "next/link";
import { BrandRow, CoachMark } from "@/components/ui";
import { InstallCard } from "@/components/install-card";
import { CoachRead } from "@/components/coach-read";
import { IconChevron, IconGear } from "@/components/icons";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { addDays, daysBetween, fmtLong, mondayOf } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { startSession } from "./train/actions";
import { SleepCard } from "./sleep-card";
import { StepsCard } from "./steps-card";
import { getSteps, stepSummary } from "@/lib/steps";
import { WeighInForm } from "./progress/weigh-in-form";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/** Today: the Coach's note and today's workout in one card, then quick check-ins and the week. */
export default async function OverviewPage() {
  const { supabase, today, units } = await getContext();
  const programP = getProgram(supabase);
  const monday = mondayOf(today);
  const [week, { data: read }, { data: sleeps }, { data: wis }, stepRows, { data: weekSessions }] = await Promise.all([
    getWeekState(supabase, today, programP),
    supabase.from("coach_reads").select("headline, next_session, lifting, weight, recovery, signals").order("created_at", { ascending: false }).limit(1),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags, note").gte("night_of", addDays(today, -7)).order("night_of"),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(1),
    getSteps(supabase, today, 14),
    supabase.from("sessions").select("session_date").eq("status", "done").gte("session_date", monday),
  ]);
  const stepByDay = new Map(stepRows.map((r) => [r.day, r.steps]));
  const stepAvg = stepSummary(stepRows, today).avg7;
  const night = addDays(today, -1);
  const lastNight = ((sleeps ?? []) as any[]).find((s) => s.night_of === night);
  const byNight = new Map(((sleeps ?? []) as any[]).map((s) => [s.night_of, Number(s.hours)]));
  const latest = read?.[0];
  const day = week.nextDay;
  const trainedOn = new Set(((weekSessions ?? []) as any[]).map((s) => s.session_date as string));

  const lastWi = (wis ?? [])[0] as { measured_on: string; weight_kg: number } | undefined;
  const wiDue = !lastWi || lastWi.measured_on < monday;

  // The card always points at what's NEXT. Anything already finished today shows as a small tick line.
  const doneToday = week.doneToday.length ? week.doneToday : null;
  const nextTitle = week.inProgress?.title ?? day?.name ?? "Workout";

  const label = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}>
        <CoachMark />{week.inProgress ? "In progress" : "Next workout"} · {nextTitle}
      </p>
    </div>
  );

  const action = week.inProgress ? (
    <Link href={`/train/session/${week.inProgress.id}`} className="btn" style={{ height: 50, gap: 8, boxShadow: "none" }}>
      Resume {week.inProgress.title}<IconChevron stroke="currentColor" />
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

  const footer = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 10px" }}>
      {doneToday ? (
        <Link href={`/train/session/${doneToday[doneToday.length - 1].id}`} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 10, padding: "9px 12px", fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>
          <span style={{ color: "var(--kingfisher-text)", fontWeight: 800 }}>✓</span>
          <span style={{ flexGrow: 1 }}>Done today: {doneToday.map((s) => s.title).join(" + ")}</span>
          <IconChevron style={{ color: "var(--stone)" }} />
        </Link>
      ) : null}
      {action}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
        <Link href="/train">Pick another workout</Link>
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
          <p className="cap" style={{ fontSize: 12 }}>{week.doneThisWeek} {week.doneThisWeek === 1 ? "workout" : "workouts"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 5, marginTop: 8 }}>
          {DOW.map((d, i) => {
            const date = addDays(monday, i);
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

      {wiDue ? (
        <WeighInForm
          units={units}
          today={today}
          placeholder={lastWi ? w(Number(lastWi.weight_kg), units) : unit(units)}
          due
          label={daysBetween(monday, today) === 0 ? "due today" : "due this week"}
        />
      ) : null}
    </main>
  );
}
