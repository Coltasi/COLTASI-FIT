import { matchScore } from "@/lib/exercise-match";
import { fmtShort } from "@/lib/dates";
import { unit, w, type Units } from "@/lib/units";
import type { Candidate } from "@/lib/data";

/** Candidates matching what was typed, best first; ties go to what you've done most recently. */
export function searchCandidates(all: Candidate[], query: string, limit = 8): Candidate[] {
  return all
    .map((c) => ({ c, s: matchScore(query, c.name) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.c.last?.date ?? "").localeCompare(a.c.last?.date ?? "") || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

export function lastLine(c: Candidate, units: Units): string {
  return c.last
    ? `last ${c.last.top != null ? `${w(c.last.top, units)} ${unit(units)} × ` : ""}${c.last.sets.map((s) => s.reps ?? "?").join(", ")} · ${fmtShort(c.last.date)}`
    : "no history yet";
}
