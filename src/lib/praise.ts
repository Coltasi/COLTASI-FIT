/** Ways to say "great work", so the Coach doesn't repeat itself. Each works as a sentence on its own. */
export const PRAISE = [
  "Great work",
  "Nice work",
  "Well done",
  "Strong work",
  "Big win",
  "Love to see it",
  "That's how it's done",
  "Nailed it",
  "Huge",
  "Proper work",
  "That's the standard",
  "Respect",
];

/** A praise phrase picked from a seed (e.g. the date plus a tag), stable for that seed. */
export function praise(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PRAISE[h % PRAISE.length];
}
