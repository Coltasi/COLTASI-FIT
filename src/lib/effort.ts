/**
 * Workout effort: the user's own rating at Finish, and the Coach's honest grade worked out
 * from the logs (each lift vs the time before, plus skipped lifts).
 */
export type Effort = "slacked" | "okay" | "solid" | "pushed";
export const EFFORTS: Effort[] = ["slacked", "okay", "solid", "pushed"];
export const EFFORT_LABEL: Record<Effort, string> = { slacked: "Slacked", okay: "Okay", solid: "Solid", pushed: "Pushed hard" };
export const EFFORT_COLOR: Record<Effort, { bg: string; fg: string }> = {
  pushed: { bg: "var(--tint-blue)", fg: "var(--kingfisher-text)" },
  solid: { bg: "var(--tint-blue)", fg: "var(--kingfisher-text)" },
  okay: { bg: "var(--tint-neutral)", fg: "var(--muted)" },
  slacked: { bg: "var(--tint-ember)", fg: "var(--rust)" },
};
export const isEffort = (v: unknown): v is Effort => typeof v === "string" && (EFFORTS as string[]).includes(v);

type LiftLike = { reps: number[]; change: { from: number | null; kg: number | null; repsFrom: number[] } | null };
export type Verdict = { grade: Effort; better: number; same: number; worse: number; skipped: number; compared: number; line: string };

const sum = (a: number[]) => a.reduce((s, n) => s + (Number(n) || 0), 0);

/** The Coach's grade for a finished session, from its lift signals. null when there's too little to compare. */
export function gradeSession(lifts: LiftLike[] | null | undefined, skipped = 0): Verdict | null {
  let better = 0, same = 0, worse = 0;
  for (const l of lifts ?? []) {
    const c = l.change;
    if (!c || (c.from == null && !c.repsFrom?.length)) continue;
    let d = c.kg != null && c.kg !== 0 ? Math.sign(c.kg) : Math.sign(sum(l.reps) - sum(c.repsFrom ?? []));
    if (c.kg == null && !c.repsFrom?.length) d = 0;
    if (d > 0) better++; else if (d < 0) worse++; else same++;
  }
  const compared = better + same + worse;
  if (compared + skipped < 2) return null;
  const down = worse + skipped;
  const grade: Effort = compared >= 2 && better * 2 >= compared && down <= 1 ? "pushed"
    : better > down ? "solid"
    : down > better ? "slacked"
    : "okay";
  const bits: string[] = [];
  if (compared) bits.push(better ? `Beat last time on ${better} of ${compared} lifts` : `Matched last time on ${compared === 1 ? "your lift" : `all ${compared} lifts`}`);
  if (worse) bits.push(`${worse} went backwards`);
  if (skipped) bits.push(`${skipped} skipped`);
  return { grade, better, same, worse, skipped, compared, line: bits.join(", ") + "." };
}

const RANK: Record<Effort, number> = { slacked: 0, okay: 1, solid: 2, pushed: 3 };

/** One honest line when the user's rating and the logs disagree. */
export function effortCallout(self: Effort | null, v: Verdict | null, feel?: string | null): string | null {
  if (!v) return null;
  const offDay = feel === "sick" || feel === "low";
  if (offDay && RANK[v.grade] <= 1) return feel === "sick" ? "You were sick, so holding steady is fine." : "Low-energy day, so holding steady is fine.";
  if (!self) return v.grade === "slacked" ? "Honest read: this one was a step back." : null;
  const gap = RANK[self] - RANK[v.grade];
  if (gap >= 2) return `You said ${EFFORT_LABEL[self].toLowerCase()}, but the logs don't back it up. Add weight or reps next time.`;
  if (gap <= -2) return `You said ${EFFORT_LABEL[self].toLowerCase()}, but the logs say ${EFFORT_LABEL[v.grade].toLowerCase()}. Give yourself some credit.`;
  return null;
}
