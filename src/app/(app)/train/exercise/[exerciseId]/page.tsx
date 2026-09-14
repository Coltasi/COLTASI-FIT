import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("id", exerciseId)
    .single();

  if (!exercise) notFound();

  const { data: programExerciseRows } = await supabase
    .from("program_exercises")
    .select("target_rep_range, program_days(name)")
    .eq("exercise_id", exerciseId)
    .limit(1);

  const programExercise = programExerciseRows?.[0];
  const programDay = programExercise?.program_days as unknown as { name: string } | null;

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("weight_kg, reps, workout_sessions(session_date)")
    .eq("exercise_id", exerciseId)
    .eq("completed", true)
    .not("weight_kg", "is", null)
    .order("created_at", { ascending: true });

  type SessionEntry = { date: string; weight: number; reps: number; setCount: number };
  const bySessionDate = new Map<string, SessionEntry>();
  for (const s of sets ?? []) {
    const sess = s.workout_sessions as unknown as { session_date: string } | null;
    if (!sess) continue;
    const cur = bySessionDate.get(sess.session_date);
    if (cur) {
      cur.setCount += 1;
      cur.weight = Math.max(cur.weight, s.weight_kg!);
    } else {
      bySessionDate.set(sess.session_date, {
        date: sess.session_date,
        weight: s.weight_kg!,
        reps: s.reps!,
        setCount: 1,
      });
    }
  }

  const chronological = [...bySessionDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const recent = chronological.slice(-6);
  const log = [...chronological].reverse();

  const best = chronological.length
    ? chronological.reduce((a, b) => (b.weight > a.weight ? b : a))
    : null;

  const weights = recent.map((r) => r.weight);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 0;
  const span = maxW - minW || 1;
  const points = recent.map((r, i) => {
    const x = recent.length > 1 ? (i / (recent.length - 1)) * 300 + 10 : 160;
    const y = 80 - ((r.weight - minW) / span) * 60;
    return { x, y };
  });

  return (
    <div className="px-5 pt-[24px] pb-8">
      <div className="flex items-center gap-2.5">
        <Link href="/train">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="text-muted text-[15px]">Lifting Progress</span>
      </div>
      <h1 className="font-display mt-1 text-[22px] font-extrabold tracking-tight">
        {exercise.name}
      </h1>
      <p className="text-muted mb-4 text-[13px]">
        {[programDay?.name, programExercise?.target_rep_range ? `${programExercise.target_rep_range} rep range` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {best ? (
        <div className="border-border bg-surface mb-4 rounded-[18px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <span className="font-display text-[26px] font-extrabold tracking-tight">
                {best.weight} kg
              </span>
              <span className="text-muted ml-2 text-xs">
                best · {formatShortDate(best.date)}
              </span>
            </div>
          </div>
          {recent.length > 1 && (
            <>
              <svg viewBox="0 0 320 100" width="100%" height="100" style={{ overflow: "visible" }}>
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#2B7FAE"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#2B7FAE" />
                ))}
                <line x1="0" y1="90" x2="320" y2="90" stroke="#E4E1D9" strokeWidth="1" />
              </svg>
              <div className="text-muted flex justify-between text-xs">
                {recent.map((r) => (
                  <span key={r.date}>{formatShortDate(r.date)}</span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-muted mb-4 text-[14px]">
          No logged sets yet — this fills in once you&apos;ve done {exercise.name} in a
          workout.
        </p>
      )}

      {log.length > 0 && (
        <>
          <p className="mb-2.5 text-[15px] font-semibold">Session log</p>
          <div className="flex flex-col gap-2.5">
            {log.map((entry) => (
              <div
                key={entry.date}
                className="border-border bg-surface rounded-xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
              >
                <p className="text-[15px] font-semibold">{formatShortDate(entry.date)}</p>
                <p className="text-muted text-xs">
                  {entry.setCount} × {entry.reps} @ {entry.weight} kg
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
