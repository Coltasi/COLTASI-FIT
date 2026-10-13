import Link from "next/link";
import { BrandRow, CoachMark } from "@/components/ui";
import { InstallCard } from "@/components/install-card";
import { CoachRead, Disclosure } from "@/components/coach-read";
import { IconChevron, IconGear } from "@/components/icons";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { getLiftHistory } from "@/lib/lifts";
import { addDays, daysBetween, fmtLong, mondayOf } from "@/lib/dates";
import { unit, w } from "@/lib/units";
import { startSession } from "./train/actions";
import { SleepCard } from "./sleep-card";
import { Sparkline } from "./progress/parts";
import { WeighInForm } from "./progress/weigh-in-form";

export default async function OverviewPage() {
  const { supabase, today, units } = await getContext();
  const programP = getProgram(supabase);
  const monday = mondayOf(today);
  const [program, week, hist, { data: read }, { data: sleeps }, { data: wis }] = await Promise.all([
    programP,
    getWeekState(supabase, today, programP),
    getLiftHistory(supabase),
    supabase.from("coach_reads").select("headline, lifting, weight, recovery").order("created_at", { ascending: false }).limit(1),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling, flags, note").gte("night_of", addDays(today, -7)).order("night_of"),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(1),
  ]);
  const split = program.filter((d) => d.program === "split");
  const doneCount = split.filter((d) => week.done.has(d.id)).length;
  const night = addDays(today, -1);
  const lastNight = ((sleeps ?? []) as any[]).find((s) => s.night_of === night);
  const byNight = new Map(((sleeps ?? []) as any[]).map((s) => [s.night_of, Number(s.hours)]));
  const latest = read?.[0];
  const day = week.nextDay;
  const todayDone = day ? week.done.get(day.id) === today : false;
  const afterNext = split.find((d) => !week.done.has(d.id) && d.id !== day?.id);

  // A PR is the heaviest top set ever. Most recent new best first.
  const prs = hist
    .map((h) => {
      let best = -Infinity, bestDate = "";
      for (const s of h.sessions) if (s.top != null && s.top > best) { best = s.top; bestDate = s.date; }
      return { id: h.exercise_id, name: h.name, best, bestDate, tops: h.sessions.map((s) => s.top).filter((x): x is number => x != null) };
    })
    .filter((p) => p.bestDate)
    .sort((a, b) => (a.bestDate < b.bestDate ? 1 : a.bestDate > b.bestDate ? -1 : 0))
    .slice(0, 5);

  const lastWi = (wis ?? [])[0] as { measured_on: string; weight_kg: number } | undefined;
  const wiDue = !lastWi || lastWi.measured_on < monday;

  return (
    <main className="screen">
      <BrandRow right={<Link href="/settings" className="iconbtn" aria-label="Settings"><IconGear /></Link>} />
      <div>
        <p className="cap" style={{ fontWeight: 600 }}>{fmtLong(today)}</p>
        <h1 className="disp" style={{ fontSize: 30, marginTop: 2 }}>Overview</h1>
      </div>

      <InstallCard />

      {latest ? (
        <CoachRead
          padding="16px"
          read={latest}
          label={<p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}><CoachMark />Coach</p>}
          footer={<div style={{ textAlign: "right", marginTop: 4 }}><Link href="/coach" style={{ fontSize: 13, fontWeight: 600 }}>Ask Coach</Link></div>}
        />
      ) : (
        <div className="card cream" style={{ padding: 16 }}>
          <p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}><CoachMark />Coach</p>
          <p style={{ fontSize: 15, lineHeight: 1.45, marginTop: 6 }}>Your first Coach read shows up after your first session or Monday weigh-in.</p>
          <div style={{ textAlign: "right", marginTop: 8 }}><Link href="/coach" style={{ fontSize: 13, fontWeight: 600 }}>Ask Coach</Link></div>
        </div>
      )}

      <SleepCard
        key={lastNight ? `${lastNight.hours}-${lastNight.wake_feeling}` : "none"}
        night={night}
        logged={lastNight ? { hours: Number(lastNight.hours), wake_feeling: lastNight.wake_feeling, flags: lastNight.flags ?? [], note: lastNight.note } : null}
        bars={Array.from({ length: 7 }, (_, i) => { const n = addDays(today, i - 7); return { night: n, hours: byNight.get(n) ?? null }; })}
      />

      {day ? (
        <div style={{ background: "var(--navy)", borderRadius: 18, padding: 16, boxShadow: "0 6px 18px rgba(21,50,97,.18)", color: "#fff", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p className="lab" style={{ color: "var(--lagoon)" }}>Suggested today</p>
              <p className="disp" style={{ fontSize: 30, lineHeight: 1.1, marginTop: 2 }}>{week.inProgress?.title ?? day.name}</p>
              <p style={{ fontSize: 13, color: "#c9d3e3", marginTop: 4 }}>The Split · {doneCount} of {split.length} done this week</p>
              <p style={{ fontSize: 13, color: "#c9d3e3" }}>{afterNext ? `Next in The Split · ${afterNext.name} after that` : "Last day of The Split this week"}</p>
            </div>
            <span className={`tag ${week.inProgress || !todayDone ? "ember" : "blue"}`}>{week.inProgress ? "In progress" : todayDone ? "Done" : "Not started"}</span>
          </div>
          {week.inProgress ? (
            <Link href={`/train/session/${week.inProgress.id}`} className="btn" style={{ height: 52, gap: 8, boxShadow: "0 6px 18px rgba(176,64,29,.35)" }}>
              Resume {week.inProgress.title}<IconChevron stroke="currentColor" />
            </Link>
          ) : (
            <form action={startSession}>
              <input type="hidden" name="day_id" value={day.id} />
              <input type="hidden" name="quick" value="1" />
              <button type="submit" className="btn" style={{ height: 52, gap: 8, boxShadow: "0 6px 18px rgba(176,64,29,.35)" }}>
                Start {day.name}<IconChevron stroke="currentColor" />
              </button>
            </form>
          )}
        </div>
      ) : null}

      {prs.length ? (
        <Disclosure title="Recent PRs" openSummary="top set"
          summary={`${prs[0].name} ${w(prs[0].best, units)} ${unit(units)}${prs.length > 1 ? ` + ${prs.length - 1} more` : ""}`}>
          {prs.map((p) => (
            <Link key={p.id} href={`/progress/exercise/${p.id}?from=overview`} className="row" style={{ borderTop: "1px solid var(--line-soft)" }}>
              <span className="ln" style={{ flexGrow: 1, minWidth: 0 }}>{p.name}</span>
              <Sparkline values={p.tops.slice(-8)} />
              <span style={{ flexShrink: 0, width: 64, textAlign: "right" }}><span className="num" style={{ fontSize: 17 }}>{w(p.best, units)}</span> <span className="cap">{unit(units)}</span></span>
              <IconChevron style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </Disclosure>
      ) : null}

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
