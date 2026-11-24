/**
 * Where balance work belongs relative to heavy lifts.
 * - Turkish Get-Ups and light Bosu drills before heavy lifts are primers: 1–2 short sets, not to failure.
 * - Loaded Bosu work (7 kg or more, or multi-move complexes) goes after heavy lifts, as a finisher.
 *   Before heavy lifts it tires the stabilisers (glute med, ankles) the big lifts rely on.
 */

/** A bell this heavy or more makes Bosu work "loaded". */
export const LOADED_BOSU_KG = 7;

export const isBosu = (name: string) => /bosu/i.test(name);
export const isGetUp = (name: string) => /turkish|get[- ]?up/i.test(name);

/** Heavy compound lifts that need fresh stabilisers. */
export const isHeavyCompound = (name: string) =>
  !isBosu(name) && !isGetUp(name) && /squat|deadlift|\brdl\b|bench|overhead press|z(anetti)? press|hip thrust|lunge|clean/i.test(name);

export type Role = "primer" | "finisher" | "misplaced" | null;

type Lift = { id: string; name: string; skipped?: unknown; heaviestKg: number | null };

/**
 * Role of each balance lift in today's order.
 * heaviestKg: heaviest weight logged today, else last time (null when unknown).
 */
export function balanceRoles(lifts: Lift[]): { roles: Map<string, Role>; lastHeavyId: string | null } {
  const live = lifts.filter((l) => !l.skipped);
  const heavy = live.map((l, i) => (isHeavyCompound(l.name) ? i : -1)).filter((i) => i >= 0);
  const firstHeavy = heavy.length ? heavy[0] : -1;
  const lastHeavyId = heavy.length ? live[heavy[heavy.length - 1]].id : null;
  const roles = new Map<string, Role>();
  live.forEach((l, i) => {
    const before = firstHeavy >= 0 && i < firstHeavy;
    if (isGetUp(l.name)) roles.set(l.id, before ? "primer" : null);
    else if (isBosu(l.name)) {
      const loaded = (l.heaviestKg ?? 0) >= LOADED_BOSU_KG;
      roles.set(l.id, before ? (loaded ? "misplaced" : "primer") : "finisher");
    }
  });
  return { roles, lastHeavyId };
}

export const PRIMER_CUE = "Primer: 1–2 short sets. Wake it up, don't tire it out";
export const FINISHER_CUE = "Finisher: stop when your balance or form goes";
