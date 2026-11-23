import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { getLiftHistory } from "@/lib/lifts";

const GOOD_NIGHT = 7;

/**
 * Each recent workout: the night of sleep before it (bar) and how many lifts went up (Ember number).
 * A lift "went up" when its top set was heavier than last time, or the same weight for more total reps.
 */
export async function SleepVsLifts({ supabase }: { supabase: Supa }) {
  const [hist, { data: nights }] = await Promise.all([
    getLiftHistory(supabase),
    supabase.from("sleep_logs").select("night_of, hours").order("night_of", { ascending: false }).limit(120),
  ]);
  const sleep = new Map(((nights ?? []) as { night_of: string; hours: number | null }[]).map((n) => [n.night_of, n.hours == null ? null : Number(n.hours)]));

  const byDate = new Map<string, { up: number; lifts: number }>();
  for (const ex of hist) {
    ex.sessions.forEach((s, i) => {
      const d = byDate.get(s.date) ?? { up: 0, lifts: 0 };
      d.lifts += 1;
      const prev = ex.sessions[i - 1];
      if (prev) {
        const reps = (x: typeof s) => x.sets.reduce((a, z) => a + (z.reps ?? 0), 0);
        const heavier = s.top != null && prev.top != null && s.top > prev.top + 0.01;
        const sameWeight = s.top === prev.top || (s.top != null && prev.top != null && Math.abs(s.top - prev.top) < 0.01);
        if (heavier || (sameWeight && reps(s) > reps(prev))) d.up += 1;
      }
      byDate.set(s.date, d);
    });
  }

  const rows = [...byDate.entries()]
    .map(([date, v]) => ({ date, ...v, hours: sleep.get(addDays(date, -1)) ?? null }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-14);
  const withSleep = rows.filter((r) => r.hours != null);
  if (withSleep.length < 3) return null;

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const good = avg(withSleep.filter((r) => r.hours! >= GOOD_NIGHT).map((r) => r.up));
  const poor = avg(withSleep.filter((r) => r.hours! < GOOD_NIGHT).map((r) => r.up));
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <p className="sec">Sleep vs lifts</p>
      {good != null && poor != null ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <div className="stat"><b style={{ color: "var(--kingfisher-text)" }}>{r1(good)}</b><span>lifts up after {GOOD_NIGHT}h+</span></div>
            <div className="stat"><b>{r1(poor)}</b><span>after a short night</span></div>
          </div>
        </>
      ) : (
        <p className="cap" style={{ marginTop: 6, fontSize: 14 }}>
          {good != null ? `Every night before a workout was ${GOOD_NIGHT}h+. ${r1(good)} lifts up per workout.`
            : `Every night before a workout was under ${GOOD_NIGHT}h. ${r1(poor!)} lifts up per workout.`}
        </p>
      )}
    </div>
  );
}
