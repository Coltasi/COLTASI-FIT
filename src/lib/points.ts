/** A Coach headline split into short points: one sentence per bullet, at most three. */
export function points(text: string) {
  return text.split(/\n+|(?<=[.!?])\s+(?=[A-Z"'])/).map((t) => t.trim()).filter(Boolean).slice(0, 3);
}

/** The briefing headline: the first point, joined to the next one when the first is only a short opener ("Great work."). */
export function headline(text: string) {
  const [first, ...rest] = points(text);
  if (!first) return { head: null as string | null, rest: [] as string[] };
  return first.length < 24 && rest.length ? { head: `${first} ${rest[0]}`, rest: rest.slice(1) } : { head: first, rest };
}
