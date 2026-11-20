/**
 * Compact Coach plan, built straight from a read's stored signals: only the lifts that change
 * next time. Lifts you repeat are summed up in one line, since Train already shows last numbers.
 * Older reads without signals fall back to text (see coach-read.tsx).
 */
import { w, unit, type Units } from "@/lib/units";
import type { LiftSignal, SleepSignal, DayDue } from "@/lib/coach-signals";

export type PlanSignals = {
  kind: "session" | "weigh_in" | "scan";
  liftsFor: string | null;
  lifts: LiftSignal[];
  splitDue: DayDue[];
  sleep: SleepSignal;
};

const BLUE = "var(--kingfisher-text)";
const RUST = "var(--rust)";

function sleepTag(s: SleepSignal) {
  const h = s.lastNight ? `${Math.round(Number(s.lastNight.hours) * 10) / 10} h` : null;
  if (s.call === "push") return { text: "Slept well · push", bg: "var(--tint-blue)", fg: BLUE };
  if (s.call === "ease") return { text: `${h ? `${h} · ` : ""}ease off`, bg: "var(--tint-ember)", fg: RUST };
  if (s.call === "normal") return { text: "Train as planned", bg: "var(--tint-neutral)", fg: "var(--navy)" };
  return { text: "Log your sleep", bg: "var(--tint-neutral)", fg: "var(--muted)" };
}

/** What a lift changes to next time, or null when it stays the same. */
export function liftChange(l: Pick<LiftSignal, "call" | "bodyweight" | "top" | "nextKg">, units: Units) {
  const u = unit(units);
  const noKg = l.bodyweight || l.nextKg == null;
  if (l.call === "up") return { tone: "up" as const, text: noKg ? "+2 reps" : `${w(l.top, units)} → ${w(l.nextKg, units)} ${u}`, short: noKg ? "↑ +2 reps" : `↑ ${w(l.nextKg, units)} ${u}` };
  if (l.call === "back_off") return { tone: "down" as const, text: noKg ? "Drop a set" : `${w(l.top, units)} → ${w(l.nextKg, units)} ${u}`, short: noKg ? "↓ Drop a set" : `↓ ${w(l.nextKg, units)} ${u}` };
  return null;
}

const rowCss = { display: "flex", justifyContent: "space-between", gap: 10, background: "#fff", borderRadius: 10, padding: "10px 12px", marginTop: 8, fontSize: 14, fontWeight: 600 } as const;
const noteCss = { fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.4 } as const;

export function CoachPlan({ s, weight, units }: { s: PlanSignals; weight: string | null; units: Units }) {
  const tag = sleepTag(s.sleep);
  const ease = s.sleep.call === "ease";
  const ups = s.lifts.filter((l) => l.call === "up");
  const downs = s.lifts.filter((l) => l.call === "back_off");
  const changes = ease ? downs : [...ups, ...downs];
  const rest = s.lifts.length - changes.length;
  const title = s.liftsFor ? `Next ${s.liftsFor}` : "Next session";

  let note: string | null = null;
  if (ease) {
    const first = ups[0];
    const reason = s.sleep.reasons[0];
    note = first
      ? `${first.name} is ready for ${first.bodyweight || first.nextKg == null ? "more reps" : `${w(first.nextKg, units)} ${unit(units)}`}. Save it for a good night.`
      : `${reason ? reason[0].toUpperCase() + reason.slice(1) : "Poor sleep"}. No PR attempts.`;
  } else if (downs.length) {
    note = `${downs.length === 1 ? `Stuck ${downs[0].stalledFor} sessions` : "Stuck for a while"}. Drop and build back.${rest ? " Everything else: same." : ""}`;
  } else if (changes.length && rest) note = "Everything else: same as last time.";

  return (
    <div style={{ borderTop: "1px solid #e6dcc0", paddingTop: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <p className="lab" style={{ color: "var(--navy)" }}>{title}</p>
        <span className="tag" style={{ background: tag.bg, color: tag.fg }}>{tag.text}</span>
      </div>

      {ease ? (
        <div style={rowCss}><span>All lifts</span><span style={{ color: RUST, whiteSpace: "nowrap" }}>Same weight, 1 less set</span></div>
      ) : null}
      {changes.map((l) => {
        const c = liftChange(l, units)!;
        return (
          <div key={l.name} style={rowCss}>
            <span style={{ minWidth: 0 }}>{l.name}</span>
            <span className="num" style={{ color: c.tone === "up" ? BLUE : RUST, whiteSpace: "nowrap" }}>{c.text}</span>
          </div>
        );
      })}
      {!ease && !changes.length && s.lifts.length ? (
        <p style={{ fontSize: 15, fontWeight: 600, marginTop: 10, lineHeight: 1.4 }}>Same as last time. Aim for one more rep per set.</p>
      ) : null}

      {note ? <p style={noteCss}>{note}</p> : null}
      {weight ? <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.4 }}><b>Weight · </b>{weight}</p> : null}
    </div>
  );
}
