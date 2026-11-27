import Link from "next/link";
import type { ReactNode } from "react";
import { CoachMark, PageHeader, Section } from "@/components/ui";
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
import { EffortTag } from "@/components/effort";
import { effortCallout, gradeSession, type Effort, type LiftLike } from "@/lib/effort";
import type { Num, NightRow, SignalsJson } from "@/lib/rows";
import { daysBetween } from "@/lib/dates";
import { pepTalk } from "@/lib/pep";

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
  // For the Coach's pep talk: yesterday's food, drink-free days, and where the goals stand.
  const [{ data: recentFood }, { data: lastDrink }, { data: firstFood }, { data: lastScan }, { data: lastWeigh }] = await Promise.all([
    supabase.from("food_logs").select("day, kcal, protein_g").gte("day", addDays(today, -7)).lt("day", today),
    supabase.from("food_logs").select("day").eq("source", "drink").order("day", { ascending: false }).limit(1),
    supabase.from("food_logs").select("day").order("day").limit(1),
    supabase.from("scans").select("scanned_on, weight_kg, body_fat_pct").order("scanned_on", { ascending: false }).limit(1),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(1),
  ]);
  const food = (foodRows ?? []) as { kcal: number; protein_g: Num }[];
  const foodKcal = food.reduce((s, r) => s + Number(r.kcal), 0);
  const foodProtein = food.reduce((s, r) => s + Number(r.protein_g), 0);
  const calSessions: CalSession[] = ((calRows ?? []) as { id: string; session_date: string; kind: string; title: string }[])
    .map((r) => ({ id: r.id, date: r.session_date, kind: r.kind, title: r.title }));
  const stepByDay = new Map(stepRows.map((r) => [r.day, r.steps]));
  const stepAvg = stepSummary(stepRows, today).avg7;
  const night = addDays(today, -1);
  const nights = (sleeps ?? []) as NightRow[];
  const lastNight = nights.find((s) => s.night_of === night);
  const byNight = new Map(nights.map((s) => [s.night_of, Number(s.hours)]));
  const latest = read?.[0];
  const day = week.nextDay;
  const weekCount = (weekSessions ?? []).length;
  const trainedOn = new Set(((weekSessions ?? []) as { session_date: string }[]).map((s) => s.session_date));

  // A finished session today (custom or kettlebell included) counts as today's workout.
  const doneToday = !week.inProgress && week.doneToday.length ? week.doneToday : null;
  const label = <p className="eyebrow"><CoachMark size={24} />Your coach</p>;

  // After a workout, the Coach grades it honestly from the logs, next to your own rating.
  let lead: ReactNode = null;
  if (latest?.kind === "session" && latest.source_id) {
    const { data: src } = await supabase.from("sessions").select("effort, feel, session_exercises(skipped_reason, skill)").eq("id", latest.source_id).maybeSingle();
    const skipped = ((src?.session_exercises ?? []) as { skipped_reason: string | null; skill: boolean }[]).filter((x) => x.skipped_reason && !x.skill).length;
    const v = gradeSession((latest.signals as SignalsJson<LiftLike>)?.lifts, skipped);
    if (v) {
      const callout = effortCallout((src?.effort as Effort | null) ?? null, v, src?.feel ?? null);
      lead = (
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            Last workout <EffortTag grade={v.grade} />
          </span>
          <span style={{ fontSize: 16, color: "var(--navy)", fontWeight: 400 }}>{v.line}{callout ? ` ${callout}` : ""}</span>
        </span>
      );
    }
  }

  const action = week.inProgress ? (
    <Link prefetch={false} href={`/train/session/${week.inProgress.id}`} className="btn">
      Resume {week.inProgress.title}<IconChevron stroke="currentColor" />
    </Link>
  ) : doneToday ? (
    <Link prefetch={false} href={`/train/session/${doneToday[doneToday.length - 1].id}`} className="btn">
      Review today&apos;s workout<IconChevron stroke="currentColor" />
    </Link>
  ) : day ? (
    <form action={startSession}>
      <input type="hidden" name="day_id" value={day.id} />
      <input type="hidden" name="quick" value="1" />
      <button type="submit" className="btn">
        Start {day.name}<IconChevron stroke="currentColor" />
      </button>
    </form>
  ) : null;

  // Skipped lifts that suit the next workout: the Coach reminds you before you start.
  const owed = !week.inProgress && !doneToday && day ? owedFor(owedAll, day.name, day.exercises.map((x) => x.name)) : [];
  const owedNote = owed.length ? (
    <p style={{ fontSize: 16, lineHeight: 1.45, color: "var(--on-navy)" }}>
      {owed.length === 1
        ? `You still owe ${owed[0].name} from ${owed[0].from} (skipped, ${SKIP_LABEL[owed[0].reason]}). Fit it into ${day!.name} today: tap Add once you start.`
        : `You still owe ${owed.length} skipped lifts: ${owed.map((o) => o.name).join(", ")}. Add them once you start ${day!.name}.`}
    </p>
  ) : null;

  const footer = action || owedNote ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
      {owedNote}
      {action}
    </div>
  ) : null;

  const yest = addDays(today, -1);
  const kcalByDay = new Map<string, { kcal: number; protein: number }>();
  for (const r of (recentFood ?? []) as { day: string; kcal: Num; protein_g: Num }[]) {
    const t = kcalByDay.get(r.day) ?? { kcal: 0, protein: 0 };
    t.kcal += Number(r.kcal); t.protein += Number(r.protein_g ?? 0);
    kcalByDay.set(r.day, t);
  }
  const loggedDays = [...kcalByDay.values()].filter((t) => t.kcal >= 1000).length;
  const y = kcalByDay.get(yest) ?? { kcal: 0, protein: 0 };
  const drinkDay = (lastDrink?.[0] as { day: string } | undefined)?.day ?? null;
  const foodStart = (firstFood?.[0] as { day: string } | undefined)?.day ?? null;
  const dryFrom = drinkDay ? addDays(drinkDay, 1) : foodStart;
  const before = calSessions.filter((x) => x.date < today).at(-1)?.date ?? null;
  const scan = lastScan?.[0] as { scanned_on: string; weight_kg: Num | null; body_fat_pct: Num | null } | undefined;
  const wi = lastWeigh?.[0] as { measured_on: string; weight_kg: Num } | undefined;
  const nowKg = wi && (!scan?.weight_kg || wi.measured_on >= scan.scanned_on) ? Number(wi.weight_kg) : scan?.weight_kg != null ? Number(scan.weight_kg) : null;
  const pep = pepTalk({
    today, units,
    inProgressTitle: week.inProgress?.title ?? null,
    doneTodayTitle: doneToday ? doneToday[doneToday.length - 1].title : null,
    nextDayName: day?.name ?? null,
    workoutsThisWeek: weekCount,
    daysSinceWorkout: before ? daysBetween(before, today) : null,
    roughNight: !!lastNight && (Number(lastNight.hours) < 6 || ["groggy", "tired", "exhausted"].includes(lastNight.wake_feeling ?? "")),
    yesterday: { ...y, logged: y.kcal >= 1000 },
    targets: { kcal: profile.target_kcal ?? null, protein: profile.protein_g ?? null },
    dryDays: dryFrom && loggedDays >= 4 ? daysBetween(dryFrom, today) : null,
    bodyFat: { now: scan?.body_fat_pct == null ? null : Number(scan.body_fat_pct), goal: profile.goal_body_fat_pct == null ? null : Number(profile.goal_body_fat_pct) },
    weight: { now: nowKg, goal: profile.goal_weight_kg == null ? null : Number(profile.goal_weight_kg) },
  });

  // Contextual headline from today's actual training state, never a generic slogan.
  const headline = week.inProgress ? `${week.inProgress.title} in progress.`
    : doneToday ? `${doneToday[doneToday.length - 1].title} complete.`
    : day ? `${day.name} is next.`
    : "Rest and recover.";

  // Streak of weeks with at least one workout, ending this week, and days trained this month.
  const wkStart = (d: string) => addDays(d, -new Date(d + "T12:00:00Z").getUTCDay());
  const weeksTrained = new Set(calSessions.map((x) => wkStart(x.date)));
  let streak = 0;
  for (let wk = sunday; weeksTrained.has(wk); wk = addDays(wk, -7)) streak++;
  const monthDays = new Set(calSessions.filter((x) => x.date.startsWith(today.slice(0, 7))).map((x) => x.date)).size;

  const tKcal = profile.target_kcal ?? null;
  const tProt = profile.protein_g ?? null;
  const kcalLeft = tKcal ? Math.round(tKcal - foodKcal) : null;
  const protLeft = tProt ? Math.round(tProt - foodProtein) : null;

  return (
    <main className="screen" style={{ gap: 28 }}>
      <PageHeader
        right={<Link prefetch={false} href="/settings" className="iconbtn" aria-label="Settings"><IconGear /></Link>}
        above={fmtLong(today)}
        title={headline}
      />

      <InstallCard />

      {latest ? (
        <CoachRead feature read={latest} units={units} label={label} lead={lead} footer={footer} pep={pep} />
      ) : (
        <section className="feature">
          {label}
          <p className="feature-title" style={{ fontSize: 22 }}>{pep[0]}</p>
          {pep[1] ? <p style={{ fontSize: 17, lineHeight: 1.45, color: "var(--on-navy)" }}>{pep[1]}</p> : null}
          {footer}
        </section>
      )}

      <Section title="Daily targets" right={<Link prefetch={false} href="/food" className="pill">Food log</Link>}>
        <div className="tiles">
          <Link prefetch={false} href="/food" className="tile" aria-label="Calories today">
            <span className="lab">Calories</span>
            <span className="big">{Math.round(foodKcal).toLocaleString("en-US")}</span>
            <span className="cap">{tKcal ? (kcalLeft! >= 0 ? `${kcalLeft!.toLocaleString("en-US")} left of ${tKcal.toLocaleString("en-US")}` : `${Math.abs(kcalLeft!).toLocaleString("en-US")} over ${tKcal.toLocaleString("en-US")}`) : "Set a target"}</span>
            <span className="meter"><i style={{ width: `${tKcal ? Math.min(100, (foodKcal / tKcal) * 100) : 0}%`, background: kcalLeft != null && kcalLeft < 0 ? "var(--crimson)" : "var(--kingfisher)" }} /></span>
          </Link>
          <Link prefetch={false} href="/food" className="tile" aria-label="Protein today">
            <span className="lab">Protein</span>
            <span className="big">{Math.round(foodProtein)} g</span>
            <span className="cap">{tProt ? (protLeft! > 0 ? `${protLeft} g to go of ${tProt}` : "Target hit") : "Set a target"}</span>
            <span className="meter"><i style={{ width: `${tProt ? Math.min(100, (foodProtein / tProt) * 100) : 0}%`, background: "var(--ember)" }} /></span>
          </Link>
          <SleepCard
            key={lastNight ? `${lastNight.hours}-${lastNight.wake_feeling}` : "none"}
            night={night}
            logged={lastNight ? { hours: Number(lastNight.hours), wake_feeling: lastNight.wake_feeling, flags: lastNight.flags ?? [], note: lastNight.note ?? null } : null}
            bars={Array.from({ length: 7 }, (_, i) => { const n = addDays(today, i - 7); return { night: n, hours: byNight.get(n) ?? null }; })}
          />
          <StepsCard
            key={`${stepByDay.get(today) ?? "none"}-${stepByDay.get(addDays(today, -1)) ?? "none"}`}
            today={today}
            avg7={stepAvg}
            bars={Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { day: d, steps: stepByDay.get(d) ?? null }; })}
          />
        </div>
      </Section>

      <Section title="Training consistency">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <p className="disp" style={{ fontSize: 22 }}>{streak > 0 ? `${streak}-week streak` : "Start a streak"}</p>
            <p className="cap">{monthDays} {monthDays === 1 ? "day" : "days"} trained this month</p>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: weekCount ? "var(--jade)" : "var(--muted)", flexShrink: 0 }}>{weekCount} this week</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6, borderTop: "1px solid var(--line-strong)", paddingTop: 12 }}>
          {DOW.map((d, i) => {
            const date = addDays(sunday, i);
            const done = trainedOn.has(date);
            const isToday = date === today;
            return (
              <Link prefetch={false} key={date} href={`/train/history?day=${date}`} aria-label={`${date}${done ? ", trained" : ""}${isToday ? ", today" : ""}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minHeight: 44, color: "inherit" }}>
                <span className="cap" style={{ fontWeight: isToday ? 800 : 500, color: isToday ? "var(--navy)" : undefined }}>{d}</span>
                <span style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: done ? "var(--kingfisher)" : "transparent", border: done ? "none" : isToday ? "2px solid var(--rust)" : "1.5px solid var(--line-strong)", color: "#fff" }}>
                  {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg> : null}
                </span>
              </Link>
            );
          })}
        </div>
        <details className="card" style={{ padding: "0 16px" }}>
          <summary style={{ listStyle: "none", minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>
            Month calendar <span className="pill">Show</span>
          </summary>
          <div style={{ paddingBottom: 16 }}><WorkoutCalendar bare sessions={calSessions} today={today} /></div>
        </details>
      </Section>
    </main>
  );
}
