import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default async function TrainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: days }, { data: pastSessions }] = await Promise.all([
    supabase
      .from("program_days")
      .select("id, name, day_order, program_exercises(count)")
      .order("day_order"),
    supabase
      .from("workout_sessions")
      .select("split_day, session_date")
      .eq("user_id", user.id)
      .not("split_day", "is", null)
      .order("session_date", { ascending: false }),
  ]);

  const lastDoneByDay = new Map<string, string>();
  for (const s of pastSessions ?? []) {
    if (s.split_day && !lastDoneByDay.has(s.split_day)) {
      lastDoneByDay.set(s.split_day, s.session_date);
    }
  }

  const splitDays = (days ?? []).filter((d) => d.day_order <= 5);
  const kettlebellDays = (days ?? []).filter((d) => d.day_order > 5);

  // Suggest whichever split day was least recently done (or never done).
  const suggestedDay = [...splitDays].sort((a, b) => {
    const aDate = lastDoneByDay.get(a.name) ?? "";
    const bDate = lastDoneByDay.get(b.name) ?? "";
    return aDate.localeCompare(bDate);
  })[0];

  function Row({
    day,
  }: {
    day: { id: string; name: string; program_exercises: { count: number }[] };
  }) {
    const lastDone = lastDoneByDay.get(day.name);
    const suggested = suggestedDay?.id === day.id;
    const exerciseCount = day.program_exercises?.[0]?.count ?? 0;

    return (
      <Link
        href={`/train/preview/${day.id}`}
        className={`flex items-center justify-between rounded-[14px] border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)] ${
          suggested ? "border-2 border-blue bg-[#F3F8FA]" : "border-border"
        }`}
      >
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <p className="text-[16px] font-semibold">{day.name}</p>
            {suggested && (
              <span className="rounded-full border border-[#D7E7EF] bg-[#E7F1F7] px-2.5 py-0.5 text-[11px] text-blue">
                Suggested
              </span>
            )}
          </div>
          <p className="text-muted text-[13px]">
            {exerciseCount} exercises
            {lastDone ? ` · last done ${formatShortDate(lastDone)}` : ""}
          </p>
        </div>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={suggested ? "#2B7FAE" : "#B8B4AB"}
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      </Link>
    );
  }

  return (
    <div className="px-5 pt-[30px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/">
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
        <Link href="/train/history" className="text-blue text-[13px] font-semibold">
          History →
        </Link>
      </div>
      <h1 className="font-display mb-4.5 mt-1 text-2xl font-extrabold tracking-tight">
        Choose today&apos;s session
      </h1>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        The Split
      </p>
      <div className="flex flex-col gap-3">
        {splitDays.map((day) => (
          <Row key={day.id} day={day} />
        ))}
      </div>

      <p className="text-muted mb-2 mt-[18px] text-xs font-bold tracking-wide uppercase">
        Kettlebell
      </p>
      <div className="flex flex-col gap-3">
        {kettlebellDays.map((day) => (
          <Row key={day.id} day={day} />
        ))}
      </div>

      <p className="text-muted mb-2 mt-[18px] text-xs font-bold tracking-wide uppercase">
        Custom
      </p>
      <div className="flex flex-col gap-3 pb-6">
        <div className="border-muted-2 rounded-[14px] border border-dashed bg-surface px-4 py-3.5 opacity-70">
          <p className="text-[16px] font-semibold">Custom Workout</p>
          <p className="text-muted text-[13px]">
            Build-it-as-you-go sessions aren&apos;t built yet.
          </p>
        </div>
      </div>
    </div>
  );
}
