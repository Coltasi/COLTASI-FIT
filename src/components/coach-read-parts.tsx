/** Coach read sections, shared by server pages and the client card. */

// Order is priority: training, then recovery, then weight (weight only appears on weigh-in and scan reads).
// "Lifting" is the old recap section; older reads still have it, new ones use "Next session".
export const PARTS = [
  ["Next session", "next_session", "var(--kingfisher)"],
  ["Lifting", "lifting", "var(--kingfisher)"],
  ["Recovery", "recovery", "var(--lagoon)"],
  ["Weight", "weight", "var(--ember)"],
] as const;

export type ReadParts = { headline: string; next_session?: string | null; lifting?: string | null; weight: string | null; recovery: string | null };

/** Section text; blank lines split paragraphs, single newlines split lines. */
export function ReadText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i} style={{ fontSize: 15, lineHeight: 1.45, marginTop: i ? 8 : 0 }}>
          {para.split("\n").map((line, j) => <span key={j} style={{ display: "block", marginTop: j ? 4 : 0 }}>{line}</span>)}
        </p>
      ))}
    </>
  );
}

