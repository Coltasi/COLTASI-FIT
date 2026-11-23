import type { Supa } from "@/lib/data";
import { addDays, fmtShort } from "@/lib/dates";
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
  const maxH = Math.max(9, ...withSleep.map((r) => r.hours!));

  return (
    <div className="card" style={{ padding: "14px 16px 12px" }}>
      <p className="lab">Sleep vs lifts</p>
      <p className="cap" style={{ marginTop: 4 }}>
        {good != null && poor != null ? (
          <>After {GOOD_NIGHT}h+ you move up <strong style={{ color: "var(--navy)" }}>{r1(good)}</strong> lifts a workout, vs <strong style={{ color: "var(--navy)" }}>{r1(poor)}</strong> after a short night.</>
        ) : good != null ? <>Every logged night before a workout was {GOOD_NIGHT}h+. You moved up {r1(good)} lifts a workout.</>
          : <>Every logged night before a workout was under {GOOD_NIGHT}h. You moved up {r1(poor!)} lifts a workout.</>}
      </p>

      <div role="img" aria-label="Sleep the night before each recent workout, with lifts that went up"
        style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))`, gap: 4, alignItems: "end", height: 120, marginTop: 14, position: "relative" }}>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 18 + (GOOD_NIGHT / maxH) * 84, borderTop: "1px dashed var(--mist)" }} />
        {rows.map((r) => (
          <div key={r.date} title={`${fmtShort(r.date)} · ${r.hours ?? "no"} h sleep · ${r.up} of ${r.lifts} lifts up`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: r.up ? "var(--rust)" : "var(--mist)", marginBottom: 3 }}>{r.up}</span>
            <div style={{
              width: "100%", maxWidth: 18, borderRadius: 4,
              height: r.hours == null ? 4 : Math.max(4, (r.hours / maxH) * 84),
              background: r.hours == null ? "var(--line-strong)" : r.hours >= GOOD_NIGHT ? "var(--lagoon)" : "var(--mist)",
            }} />
            <span className="cap" style={{ fontSize: 9, marginTop: 3, whiteSpace: "nowrap" }}>{fmtShort(r.date).split(" ")[1]}</span>
          </div>
        ))}
      </div>
      <div className="cap" style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--lagoon)" }} />{GOOD_NIGHT}h+ night</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--mist)" }} />Short night</span>
        <span style={{ color: "var(--rust)", fontWeight: 700 }}>2</span><span style={{ marginLeft: -8 }}>= lifts up</span>
      </div>
    </div>
  );
}
