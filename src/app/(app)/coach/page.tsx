import { CoachMark, PageHeader, Section } from "@/components/ui";
import { PARTS, ReadText } from "@/components/coach-read-parts";
import { CoachPlan, liftChange, type PlanSignals } from "@/components/coach-plan";
import { headline } from "@/lib/points";
import type { LiftSignal } from "@/lib/coach-signals";
import { RefreshRead } from "./refresh-read";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { addDays, fmtDay } from "@/lib/dates";

import { signed, unit, w } from "@/lib/units";
import { onPace, trendPoints, trendRate } from "@/lib/coach";
import { fmtK, getSteps, stepSummary } from "@/lib/steps";
import { AskBox } from "./ask-box";
import type { Num } from "@/lib/rows";

/** A Coach read as stored. `signals` is what the read was built from (older reads may lack parts of it). */
type ReadRow = {
  id: string; kind: string; source_id: string | null; headline: string; lifting: string | null; weight: string | null;
  recovery: string | null; next_session?: string | null; model: string | null; created_at: string;
  signals: (PlanSignals & { lifts?: LiftSignal[] }) | null;
};

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const KIND = {
  session: { label: "Workout", color: "var(--kingfisher)", bg: "var(--tint-blue)", fg: "var(--kingfisher-text)" },
  weigh_in: { label: "Weigh-in", color: "var(--ember)", bg: "var(--tint-ember)", fg: "var(--rust)" },
  scan: { label: "Body scan", color: "var(--jade)", bg: "var(--tint-jade)", fg: "var(--jade)" },
} as const;

export default async function CoachPage() {
  const { supabase, today, units, profile, tz } = await getContext();
  const programP = getProgram(supabase);
  const [, week, { data: reads }, wis, { data: sleeps }, stepRows] = await Promise.all([
    programP,
    getWeekState(supabase, today, programP),
    supabase.from("coach_reads").select("*").order("created_at", { ascending: false }).limit(12),
    trendPoints(supabase, today),
    supabase.from("sleep_logs").select("hours").gte("night_of", addDays(today, -7)),
    getSteps(supabase, today, 14),
  ]);
  const stepAvg = stepSummary(stepRows, today).avg7;
  const rate = trendRate(wis, today);
  const target = profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week);
  const behind = onPace(rate, target) === false;
  const sl = ((sleeps ?? []) as { hours: Num }[]).map((r) => Number(r.hours));
  const avgSleep = sl.length ? sl.reduce((a, b) => a + b) / sl.length : null;
  const conv = (kg: number) => (units === "imperial" ? kg * 2.20462 : kg);
  const latest = ((reads ?? []) as ReadRow[])[0];
  const dayIso = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  // Reads grouped by the day they were written, newest day first.
  const days: [string, ReadRow[]][] = [];
  for (const r of (reads ?? []) as ReadRow[]) {
    const d = dayIso(r.created_at);
    if (days.length && days[days.length - 1][0] === d) days[days.length - 1][1].push(r);
    else days.push([d, [r]]);
  }

  // Recommended actions: only lifts the latest plan changes, each with the Coach's own stated reason.
  const sig = latest?.signals && Array.isArray(latest.signals.lifts) ? latest.signals : null;
  const recs = sig ? (sig.lifts as LiftSignal[]).map((l) => ({ l, c: liftChange(l, units) })).filter((x) => x.c) : [];
  const recFor = sig?.liftsFor as string | null | undefined;
  const nextName = week.nextDay?.name;
  const recWhen = recFor ? (recFor === nextName ? `For your next session, ${recFor}` : `For your next ${recFor} session${nextName ? ` (${nextName} comes first)` : ""}`) : "For your next session";
  const head = latest ? headline(latest.headline).head : null;
  const ind = (label: string, value: string, sub: string, tone?: string) => (
    <div style={{ background: "var(--navy-2)", borderRadius: 14, padding: "12px 14px" }}>
      <p style={{ fontSize: 15, color: "var(--on-navy-muted)" }}>{label}</p>
      <p className="num" style={{ fontSize: 24, color: tone ?? "var(--on-navy)" }}>{value}</p>
      <p style={{ fontSize: 15, color: "var(--on-navy-muted)" }}>{sub}</p>
    </div>
  );

  return (
    <main className="screen" style={{ paddingBottom: 280, gap: 26 }}>
      <PageHeader title="Coach" sub="What to change, and why" />

      <section className="feature" aria-label="Weekly briefing">
        <p className="eyebrow"><CoachMark size={24} />Your weekly briefing</p>
        <p className="feature-title" style={{ fontSize: 22 }}>{head ?? "Your briefing builds as you log workouts, sleep and weigh-ins."}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
          {ind("Workouts", String(week.doneThisWeek), "this week")}
          {ind("Weight trend", rate != null ? `${signed(conv(rate))}` : "–", rate != null ? `${unit(units)}/wk${target != null ? ` · target ${signed(conv(target), 2)}` : ""}` : "need 3 weigh-ins over 2 weeks", rate == null || target == null ? undefined : behind ? "#f08a7a" : "#4fc59f")}
          {ind("Avg sleep", avgSleep != null ? `${avgSleep.toFixed(1)} h` : "–", avgSleep != null ? "last 7 nights" : "log sleep on Today")}
          {ind("Avg steps", stepAvg != null ? fmtK(stepAvg) : "–", stepAvg != null ? "last 7 days" : "log steps on Today")}
        </div>
      </section>

      <Section title="Your next move" gap={4}>
        <p className="cap">{recs.length ? recWhen : sig ? "No weight changes: repeat last time's weights and aim for an extra rep." : "Recommendations appear after your first logged workout."}</p>
        {recs.length ? (
          <div className="list">
            {recs.map(({ l, c }) => (
              <details key={l.name} className="li" style={{ display: "block" }}>
                <summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <p className="t" style={{ fontSize: 16 }}>{l.name}</p>
                    <p className="s" style={{ color: "var(--ember-text)", fontWeight: 600 }}>Why? ›</p>
                  </div>
                  <p className="v" style={{ color: c!.tone === "up" ? "var(--jade)" : "var(--rust)" }}>{c!.text}</p>
                </summary>
                <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)" }}>
                  <p style={{ fontSize: 15, lineHeight: 1.45 }}>{l.line}</p>
                  <p className="cap" style={{ marginTop: 8 }}>
                    Based on: last top set {l.top != null ? `${w(l.top, units)} ${unit(units)}` : "bodyweight"}{l.reps?.length ? ` × ${l.reps.join(", ")} reps` : ""}
                    {l.call === "back_off" ? ` · ${l.stalledFor} sessions without beating your best` : ""}
                    {l.repRange ? ` · target ${l.repRange} reps` : ""}
                  </p>
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </Section>

      <AskBox />

      <Section title="Insights" right={latest ? <RefreshRead /> : null} gap={6}>
        <p className="cap">Every read your coach has written, newest first. Tap one to see the full plan.</p>
        {reads?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 6 }}>
            {days.map(([day, rs]) => (
              <section key={day}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span className="disp" style={{ fontSize: 17, color: "var(--navy)", whiteSpace: "nowrap" }}>
                    {day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : fmtDay(day)}
                  </span>
                  <span style={{ flexGrow: 1, height: 1, background: "var(--line-strong)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rs.map((r) => {
                    const k = KIND[r.kind as keyof typeof KIND] ?? KIND.weigh_in;
                    return (
                      <details key={r.id} className="card" style={{ padding: "12px 16px" }}>
                        <summary style={{ listStyle: "none", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="tag" style={{ background: k.bg, color: k.fg }}>{k.label}</span>
                            <span className="cap">{r.id === latest?.id ? ago(r.created_at) : time(r.created_at)}</span>
                          </div>
                          <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45, marginTop: 6 }}>{r.headline}</p>
                        </summary>
                        {r.signals?.sleep && Array.isArray(r.signals.lifts) ? (
                          <div style={{ marginTop: 8 }}><CoachPlan s={r.signals} weight={r.weight} units={units} /></div>
                        ) : PARTS.filter(([, key]) => r[key]).map(([l, key]) => (
                          <div key={key} style={{ marginTop: 8 }}><p style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{l}</p><ReadText text={r[key] ?? ""} /></div>
                        ))}
                      </details>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="card cream" style={{ padding: 16, display: "flex", gap: 10 }}>
            <CoachMark />
            <p style={{ fontSize: 16, lineHeight: 1.45 }}>Finish a session or log a weigh-in and your first insight appears here.</p>
          </div>
        )}
      </Section>
    </main>
  );
}
