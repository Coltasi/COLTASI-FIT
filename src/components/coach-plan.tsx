/**
 * Coach plan, built straight from a read's stored signals, laid out as a table:
 * one row per lift, with last time's weight and what to do next time in separate columns,
 * so no numbers run together in a sentence. Weight reads get stat tiles instead of a paragraph.
 * Older reads without signals fall back to text (see coach-read.tsx).
 */
import { w, unit, signed, type Units } from "@/lib/units";
import type { LiftSignal, SleepSignal, DayDue } from "@/lib/coach-signals";

export type PlanSignals = {
  kind: "session" | "weigh_in" | "scan";
  liftsFor: string | null;
  lifts: LiftSignal[];
  splitDue: DayDue[];
  sleep: SleepSignal;
  weight?: { lines: string[]; latestKg: number | null; rateKgWeek: number | null; targetKgWeek: number | null; behind: boolean } | null;
};

const BLUE = "var(--kingfisher-text)";
const RUST = "var(--rust)";

function sleepTag(s: SleepSignal) {
  const h = s.lastNight ? `${Math.round(Number(s.lastNight.hours) * 10) / 10} h` : null;
  if (s.call === "push") return { text: `${h ? `${h} · ` : ""}Push`, bg: "var(--tint-blue)", fg: BLUE };
  if (s.call === "ease") return { text: `${h ? `${h} · ` : ""}Ease off`, bg: "var(--tint-ember)", fg: RUST };
  if (s.call === "normal") return { text: `${h ? `${h} · ` : ""}As planned`, bg: "var(--tint-neutral)", fg: "var(--navy)" };
  return { text: "Log your sleep", bg: "var(--tint-neutral)", fg: "var(--muted)" };
}

/** What a lift changes to next time, or null when it stays the same. Also used by the Train screen tag. */
export function liftChange(l: Pick<LiftSignal, "call" | "bodyweight" | "top" | "nextKg">, units: Units) {
  const u = unit(units);
  const noKg = l.bodyweight || l.nextKg == null;
  if (l.call === "up") return { tone: "up" as const, text: noKg ? "+2 reps" : `${w(l.top, units)} → ${w(l.nextKg, units)} ${u}`, short: noKg ? "↑ +2 reps" : `↑ ${w(l.nextKg, units)} ${u}` };
  if (l.call === "back_off") return { tone: "down" as const, text: noKg ? "Drop a set" : `${w(l.top, units)} → ${w(l.nextKg, units)} ${u}`, short: noKg ? "↓ Drop a set" : `↓ ${w(l.nextKg, units)} ${u}` };
  return null;
}

type Pill = { text: string; bg: string; fg: string; rank: number };

/** The "Next time" cell for one lift. */
function nextPill(l: LiftSignal, ease: boolean, units: Units): Pill {
  const u = unit(units);
  const noKg = l.bodyweight || l.nextKg == null;
  if (l.call === "back_off") return { text: noKg ? "↓ 1 less set" : `↓ ${w(l.nextKg, units)} ${u}`, bg: "var(--tint-ember)", fg: RUST, rank: 1 };
  if (l.call === "up" && ease) return { text: "Hold", bg: "var(--tint-ember-soft)", fg: RUST, rank: 2 };
  if (l.call === "up") return { text: noKg ? "↑ +2 reps" : `↑ ${w(l.nextKg, units)} ${u}`, bg: "var(--tint-blue)", fg: BLUE, rank: 0 };
  if (l.call === "new") return { text: "Repeat", bg: "var(--tint-neutral)", fg: "var(--muted)", rank: 3 };
  return { text: "Same", bg: "var(--tint-neutral)", fg: "var(--muted)", rank: 3 };
}

const th = { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" } as const;
const grid = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px 92px", alignItems: "center", gap: 8 } as const;

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 10px 8px", minWidth: 0 }}>
      <p style={th}>{label}</p>
      <p className="num" style={{ fontSize: 18, marginTop: 2, color: color ?? "var(--navy)" }}>{value}</p>
      {sub ? <p className="cap" style={{ fontSize: 11 }}>{sub}</p> : null}
    </div>
  );
}

/** Pulls "Body fat 21.6% (down 0.6% ...)" and "muscle 73.5 kg (down 0.5 kg ...)" out of the stored scan line. */
function scanBits(lines: string[]) {
  const line = lines.find((l) => l.startsWith("Scan:"));
  if (!line) return null;
  const grab = (label: RegExp) => {
    const m = line.match(label);
    if (!m) return null;
    return { value: Number(m[1]), dir: m[2] as "up" | "down" | undefined, by: m[3] ? Number(m[3]) : null };
  };
  return {
    fat: grab(/Body fat ([\d.]+)%(?: \((up|down) ([\d.]+)%)?/),
    muscle: grab(/muscle ([\d.]+) kg(?: \((up|down) ([\d.]+) kg)?/),
  };
}

function WeightTiles({ wt, units }: { wt: NonNullable<PlanSignals["weight"]>; units: Units }) {
  const u = unit(units);
  const conv = (n: number) => (units === "imperial" ? n * 2.20462 : n);
  const scan = scanBits(wt.lines);
  return (
    <div style={{ marginTop: 14 }}>
      <p className="lab" style={{ color: "var(--navy)", marginBottom: 6 }}>Body</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 }}>
        <Tile label="Weight" value={wt.latestKg != null ? `${w(wt.latestKg, units)} ${u}` : "–"} sub="latest" />
        <Tile label="Pace" value={wt.rateKgWeek != null ? signed(conv(wt.rateKgWeek)) : "–"} sub={`${u} / week`} color={wt.behind ? RUST : undefined} />
        <Tile label="Target" value={wt.targetKgWeek != null ? signed(conv(wt.targetKgWeek)) : "–"} sub={`${u} / week`} />
        {scan?.fat ? <Tile label="Body fat" value={`${scan.fat.value}%`} sub={scan.fat.dir ? `${scan.fat.dir === "down" ? "↓" : "↑"} ${scan.fat.by}% since last` : undefined} color={scan.fat.dir === "down" ? BLUE : undefined} /> : null}
        {scan?.muscle ? <Tile label="Muscle" value={`${w(scan.muscle.value, units)} ${u}`} sub={scan.muscle.dir ? `${scan.muscle.dir === "down" ? "↓" : "↑"} ${w(scan.muscle.by, units)} since last` : undefined} color={scan.muscle.dir === "down" ? RUST : undefined} /> : null}
      </div>
      <p className="cap" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.4, color: wt.behind ? RUST : "var(--muted)" }}>
        {wt.rateKgWeek == null || wt.targetKgWeek == null ? "Need two weigh-ins for a pace." : wt.behind ? "Behind target. Sleep and training first; calories only after 2 more flat weeks." : "On track."}
      </p>
    </div>
  );
}

export function CoachPlan({ s, weight, units }: { s: PlanSignals; weight: string | null; units: Units }) {
  const tag = sleepTag(s.sleep);
  const ease = s.sleep.call === "ease";
  const title = s.liftsFor ? `Next ${s.liftsFor}` : "Next session";
  const next = s.splitDue?.[0];
  const rows = s.lifts
    .map((l) => ({ l, p: nextPill(l, ease, units) }))
    .sort((a, b) => a.p.rank - b.p.rank);
  const u = unit(units);

  return (
    <div style={{ borderTop: "1px solid #e6dcc0", paddingTop: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <p className="lab" style={{ color: "var(--navy)" }}>{title}</p>
        <span className="tag" style={{ background: tag.bg, color: tag.fg }}>{tag.text}</span>
      </div>

      {ease ? (
        <div style={{ background: "var(--tint-ember)", color: RUST, borderRadius: 10, padding: "8px 12px", marginTop: 8, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
          Rough night: same weights, 1 less set, no PRs. "Hold" lifts are ready to go up once you sleep well.
        </div>
      ) : null}

      {rows.length ? (
        <div style={{ background: "#fff", borderRadius: 12, marginTop: 8, overflow: "hidden" }}>
          <div style={{ ...grid, padding: "8px 12px", borderBottom: "1px solid var(--line-soft)" }}>
            <span style={th}>Lift</span>
            <span style={{ ...th, textAlign: "right" }}>Last</span>
            <span style={{ ...th, textAlign: "right" }}>Next time</span>
          </div>
          {rows.map(({ l, p }, i) => (
            <div key={l.name} style={{ ...grid, padding: "9px 12px", borderTop: i ? "1px solid var(--line-soft)" : 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, minWidth: 0, color: p.rank === 3 ? "var(--muted)" : "var(--navy)" }}>{l.name}</span>
              <span className="num" style={{ fontSize: 14, textAlign: "right", color: "var(--muted)", whiteSpace: "nowrap" }}>
                {l.bodyweight || l.top == null ? "BW" : `${w(l.top, units)} ${u}`}
              </span>
              <span style={{ textAlign: "right" }}>
                <span className="tag num" style={{ background: p.bg, color: p.fg, fontSize: 12 }}>{p.text}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {next ? (
        <p className="cap" style={{ fontSize: 12, marginTop: 8 }}>
          <b style={{ color: "var(--navy)" }}>Due next:</b> {next.name}{next.daysSince != null ? ` (last done ${next.daysSince} day${next.daysSince === 1 ? "" : "s"} ago)` : " (not done yet)"}
        </p>
      ) : null}

      {s.weight ? <WeightTiles wt={s.weight} units={units} /> : weight ? <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.4 }}><b>Weight · </b>{weight}</p> : null}
    </div>
  );
}
