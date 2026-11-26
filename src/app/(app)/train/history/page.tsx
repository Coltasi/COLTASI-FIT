import Link from "next/link";
import { BackHeader } from "@/components/ui";
import { IconChevron } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtDay, mondayOf } from "@/lib/dates";
import { EffortTag } from "@/components/effort";
import { EFFORT_LABEL, gradeSession, isEffort } from "@/lib/effort";
import type { SignalsJson } from "@/lib/rows";
import type { LiftLike } from "@/lib/effort";

const FILTERS = [
  { k: "all", l: "All" }, { k: "split", l: "Split" }, { k: "kettlebell", l: "Kettlebell" }, { k: "custom", l: "Custom" },
];

type HistSession = {
  id: string; kind: string; title: string; session_date: string; status: string; effort: string | null;
  session_exercises: { id: string; skipped_reason: string | null; skill: boolean; exercises: { name: string } | null; session_sets: { done: boolean }[] | null }[] | null;
};

export default async function HistoryPage({ searchParams }: PageProps<"/train/history">) {
  const sp = await searchParams;
  const f = typeof sp.f === "string" && FILTERS.some((x) => x.k === sp.f) ? sp.f : "all";
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const { supabase, today } = await getContext();
  let q = supabase
    .from("sessions")
    .select("id, kind, title, session_date, status, effort, session_exercises(id, skipped_reason, skill, exercises(name), session_sets(done))")
    .neq("status", "in_progress")
    .order("session_date", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(80);
  if (f !== "all") q = q.eq("kind", f);
  if (day) q = q.eq("session_date", day);
  const [{ data }, { data: allDone }] = await Promise.all([
    q,
    supabase.from("sessions").select("session_date").eq("status", "done"),
  ]);
  // Summary: total workouts, days trained this month, and the weekly streak (Sunday-start weeks, as on Today).
  const doneDates = ((allDone ?? []) as { session_date: string }[]).map((r) => r.session_date);
  const wk = (d: string) => addDays(d, -new Date(d + "T12:00:00Z").getUTCDay());
  const weeks = new Set(doneDates.map(wk));
  let streak = 0;
  for (let w = wk(today); weeks.has(w); w = addDays(w, -7)) streak++;
  const monthDays = new Set(doneDates.filter((d) => d.startsWith(today.slice(0, 7)))).size;
  // The Coach's honest grade per workout, from the read written after it.
  const sessions = (data ?? []) as unknown as HistSession[];
  const ids = sessions.map((s) => s.id);
  const { data: reads } = ids.length
    ? await supabase.from("coach_reads").select("source_id, signals").eq("kind", "session").in("source_id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const liftsBySession = new Map<string, LiftLike[] | undefined>();
  for (const r of (reads ?? []) as { source_id: string; signals: SignalsJson<LiftLike> }[]) if (!liftsBySession.has(r.source_id)) liftsBySession.set(r.source_id, r.signals?.lifts);

  const thisMon = mondayOf(today);
  const groups = new Map<string, HistSession[]>();
  for (const s of sessions) {
    const mon = mondayOf(s.session_date);
    const label = mon === thisMon ? "This week" : mon === addDays(thisMon, -7) ? "Last week" : `Week of ${fmtDay(mon)}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }

  const KIND_LABEL: Record<string, string> = { split: "Split", kettlebell: "Kettlebell", custom: "Custom" };

  return (
    <main className="screen" style={{ gap: 22 }}>
      <BackHeader href="/train" label="Train" title="Workout history" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        {[[doneDates.length, "workouts"], [monthDays, "days this month"], [streak, "week streak"]].map(([v, l]) => (
          <div key={l as string} className="tile" style={{ padding: "14px 12px", justifyContent: "flex-start" }}>
            <span className="big" style={{ fontSize: 28, marginTop: 0 }}>{v}</span>
            <span className="cap" style={{ lineHeight: 1.3 }}>{l}</span>
          </div>
        ))}
      </div>

      {day ? (
        <div className="card cream" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", minHeight: 52 }}>
          <span className="ln">{fmtDay(day)}</span>
          <Link prefetch={false} href="/train/history" className="pill">Show all</Link>
        </div>
      ) : null}
      <div className="chips">
        {FILTERS.map((x) => (
          <Link prefetch={false} key={x.k} href={x.k === "all" ? "/train/history" : `/train/history?f=${x.k}`} className={`chip${f === x.k ? " on" : ""}`} aria-current={f === x.k ? "page" : undefined}>{x.l}</Link>
        ))}
      </div>
      {[...groups.entries()].map(([label, list]) => (
        <section key={label}>
          <h2 className="sec" style={{ marginBottom: 2 }}>{label}</h2>
          <div className="list">
            {list.map((s) => {
              const ses = s.session_exercises ?? [];
              const logged = ses.filter((x) => (x.session_sets ?? []).some((z) => z.done));
              const skipped = ses.filter((x) => x.skipped_reason).length;
              const all = ses.length - skipped;
              // Four separate dimensions: type, completion, your effort, the Coach's read of performance.
              const completion = s.status === "skipped" ? "Skipped day"
                : s.kind === "custom" ? `${logged.length} ${logged.length === 1 ? "exercise" : "exercises"}`
                : `${logged.length} of ${all} lifts logged${skipped ? ` · ${skipped} skipped` : ""}`;
              const grade = s.status === "done" ? gradeSession(liftsBySession.get(s.id), ses.filter((x) => x.skipped_reason && !x.skill).length)?.grade : null;
              const mine = isEffort(s.effort) ? EFFORT_LABEL[s.effort as keyof typeof EFFORT_LABEL] : null;
              const d = new Date(s.session_date + "T12:00:00Z");
              return (
                <Link prefetch={false} key={s.id} href={`/train/session/${s.id}`} className="li" style={{ alignItems: "flex-start" }}>
                  <div aria-hidden style={{ width: 50, flexShrink: 0, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", textAlign: "center", padding: "6px 0" }}>
                    <p className="num" style={{ fontSize: 20, lineHeight: 1.1 }}>{d.getUTCDate()}</p>
                    <p className="cap" style={{ fontSize: 15 }}>{d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</p>
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <p className="t">{s.title}</p>
                    <p className="s">{KIND_LABEL[s.kind] ?? s.kind} · {completion}</p>
                    {mine || grade ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {mine ? <span className="tag neutral">You: {mine}</span> : null}
                        {grade ? <EffortTag grade={grade} prefix="Coach" /> : null}
                      </div>
                    ) : null}
                  </div>
                  <IconChevron style={{ marginTop: 14, flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      {!groups.size ? <p className="cap" style={{ textAlign: "center", marginTop: 24 }}>{day ? "No workout logged that day." : "No sessions yet. Your first one shows up here."}</p> : null}
    </main>
  );
}
