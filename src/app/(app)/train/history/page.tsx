import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

const TAGS = {
  completed: { label: "Completed", cls: "text-blue bg-[#E7F1F7] border-[#D7E7EF]" },
  inProgress: {
    label: "In progress",
    cls: "text-muted bg-[#F0EEE9] border-[#E4E1D9]",
  },
  kettlebell: {
    label: "Kettlebell",
    cls: "text-[#1489A6] bg-[#E2F5F9] border-[#C7EAF1]",
  },
  custom: {
    label: "Custom",
    cls: "text-[#B85420] bg-[#FBEADF] border-[#F0D2B8]",
  },
} as const;

export default async function TrainHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: sessions }, { data: days }] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, session_date, session_type, split_day, completed_at")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(50),
    supabase.from("program_days").select("name, program_exercises(count)"),
  ]);

  const totalExercisesByDay = new Map<string, number>();
  for (const d of days ?? []) {
    const count = (d.program_exercises as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
    totalExercisesByDay.set(d.name, count);
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: sets } = sessionIds.length
    ? await supabase
        .from("workout_sets")
        .select("session_id, exercise_id, completed")
        .in("session_id", sessionIds)
    : { data: [] };

  const bySession = new Map<string, Map<string, { total: number; completed: number }>>();
  for (const s of sets ?? []) {
    let m = bySession.get(s.session_id);
    if (!m) {
      m = new Map();
      bySession.set(s.session_id, m);
    }
    const cur = m.get(s.exercise_id) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (s.completed) cur.completed += 1;
    m.set(s.exercise_id, cur);
  }

  function completedExerciseCount(sessionId: string) {
    const m = bySession.get(sessionId);
    if (!m) return 0;
    let n = 0;
    for (const v of m.values()) if (v.total > 0 && v.completed === v.total) n++;
    return n;
  }

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
        <span className="text-muted text-[15px]">Train</span>
      </div>
      <h1 className="font-display mt-1 mb-4.5 text-2xl font-extrabold tracking-tight">
        History
      </h1>

      {(sessions ?? []).length === 0 ? (
        <p className="text-muted text-[14px]">
          No sessions logged yet — start a workout from Train to see it here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(sessions ?? []).map((s) => {
            const isKettlebell = (s.split_day ?? "").startsWith("Full Body");
            const isCustom = s.session_type === "custom";
            const tag = isCustom
              ? TAGS.custom
              : isKettlebell
                ? TAGS.kettlebell
                : s.completed_at
                  ? TAGS.completed
                  : TAGS.inProgress;
            const total = s.split_day ? (totalExercisesByDay.get(s.split_day) ?? 0) : 0;
            const done = completedExerciseCount(s.id);

            return (
              <Link
                key={s.id}
                href={`/train/session/${s.id}`}
                className="border-border bg-surface flex items-center justify-between rounded-[14px] border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
              >
                <div>
                  <p className="text-[16px] font-semibold">
                    {s.split_day ?? "Workout"}
                  </p>
                  <p className="text-muted text-[13px]">
                    {formatShortDate(s.session_date)}
                    {total > 0 ? ` · ${done}/${total} exercises` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${tag.cls}`}
                >
                  {tag.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-muted mt-4 text-center text-[13px]">
        Tap a session to see the sets you logged that day.
      </p>
    </div>
  );
}
