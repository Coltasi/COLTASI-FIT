/**
 * The Coach's daily pep talk on the Today screen: one line of encouragement built from
 * what's actually happening (training today, a gap, a slip, a streak), plus one line on
 * progress toward the goal. Worked out fresh on every visit, so a missed week still gets
 * a "get back on track" even when no new Coach read has been written.
 * Pure function, no database access.
 */
import { w, unit, type Units } from "./units";
import { praise } from "./praise";

export type PepInput = {
  today: string;
  units: Units;
  inProgressTitle: string | null;
  doneTodayTitle: string | null;
  nextDayName: string | null;
  workoutsThisWeek: number;
  /** Days since the last finished workout before today (null if never trained). */
  daysSinceWorkout: number | null;
  /** Sleep says ease off today. */
  roughNight: boolean;
  yesterday: { kcal: number; protein: number; logged: boolean };
  targets: { kcal: number | null; protein: number | null };
  /** Days in a row without a drink logged, counted only while food is being logged. null when unknown. */
  dryDays: number | null;
  bodyFat: { now: number | null; goal: number | null };
  weight: { now: number | null; goal: number | null };
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Pick one of a few phrasings, stable for the day, so it doesn't read the same every morning. */
function pick(today: string, options: string[]): string {
  const n = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
  return options[n % options.length];
}

function mainLine(p: PepInput): string {
  if (p.inProgressTitle) return pick(p.today, [`Lock in. Finish ${p.inProgressTitle} strong.`, `You're in it. Finish ${p.inProgressTitle} strong.`]);

  if (p.doneTodayTitle) {
    if (p.workoutsThisWeek >= 3) return `That's ${p.workoutsThisWeek} workouts this week. ${praise(p.today + "week")}.`;
    return pick(p.today, [`Workout done. ${praise(p.today + "done")}.`, `${p.doneTodayTitle} done. That's how you get there.`]);
  }

  const gap = p.daysSinceWorkout;
  if (gap != null && gap >= 7) return `It's been ${gap} days. No guilt. You can get back on track, just start now. Even 20 minutes counts.`;
  if (gap != null && gap >= 3) return `It's been ${gap} days since your last workout. No stress. You can get back on track, just start now.`;

  const { kcal: tK, protein: tP } = p.targets;
  const y = p.yesterday;
  if (y.logged && tK && y.kcal > tK * 1.1) return "Over your calories yesterday. One day doesn't undo a week. Back on it today, you've got this.";

  if (p.dryDays != null && p.dryDays >= 7 && p.dryDays % 7 === 0) {
    const weeks = p.dryDays / 7;
    return weeks === 1 ? `A full week without alcohol. ${praise(p.today + "dry")}.` : `${weeks} weeks without alcohol. ${praise(p.today + "dry")}. Keep it going.`;
  }

  if (y.logged && tK && tP && y.kcal <= tK * 1.05 && y.protein >= tP * 0.95) return `Calories and protein on target yesterday. ${praise(p.today + "food")}. Do it again today.`;

  if (p.roughNight) return "Rough night. Show up anyway and go easy today. That still counts.";

  if (p.nextDayName) return pick(p.today, [`Lock in. ${p.nextDayName} today. You've got this.`, `${p.nextDayName} today. Lock in and chase one more rep.`, `${p.nextDayName} today. You've got this.`]);
  return "Rest up today. You've earned it.";
}

function goalLine(p: PepInput): string | null {
  const bf = p.bodyFat, wt = p.weight;
  const bfLine = bf.now != null && bf.goal != null
    ? bf.now <= bf.goal ? `You hit ${r1(bf.goal)}% body fat. ${praise(p.today + "goal")}.` : `${r1(bf.now)}% body fat now, ${r1(bf.goal)}% is the goal. Every session gets you closer.`
    : null;
  const toGo = wt.now != null && wt.goal != null ? wt.now - wt.goal : null;
  const wtLine = toGo == null ? null
    : toGo <= 0.3 ? `You're at your goal weight. ${praise(p.today + "goal")}.`
    : `${w(toGo, p.units)} ${unit(p.units)} to your goal weight. Keep going.`;
  // Alternate the two goals day by day when both are set.
  if (bfLine && wtLine) return new Date(p.today + "T12:00:00Z").getUTCDate() % 2 ? bfLine : wtLine;
  return bfLine ?? wtLine;
}

export function pepTalk(p: PepInput): string[] {
  return [mainLine(p), goalLine(p)].filter((x): x is string => !!x);
}
