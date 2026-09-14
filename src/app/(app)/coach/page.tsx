import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const WAKE_DESCRIPTIONS: Record<string, string> = {
  Energetic: "solid recovery",
  Rested: "decent recovery",
  Groggy: "recovery's a bit behind",
  Tired: "recovery's lagging",
  Exhausted: "recovery's really behind",
};

export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const weekAgo = daysAgoIso(6);
  const today = todayIso();

  const [
    { data: lastSleep },
    { data: weekSessions },
    { data: target },
    { data: programDays },
  ] = await Promise.all([
    supabase
      .from("sleep_logs")
      .select("hours, woke_feeling, log_date")
      .eq("user_id", user.id)
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("split_day, session_type, completed_at, session_date")
      .eq("user_id", user.id)
      .gte("session_date", weekAgo)
      .lte("session_date", today)
      .not("completed_at", "is", null),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", user.id)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("program_days").select("name"),
  ]);

  const splitDayNames = (programDays ?? [])
    .map((d) => d.name)
    .filter((n) => !n.toLowerCase().includes("kettlebell"));
  const totalSplitDays = splitDayNames.length || 5;

  const splitDaysDoneThisWeek = new Set(
    (weekSessions ?? [])
      .filter((s) => s.session_type === "split" && s.split_day)
      .map((s) => s.split_day),
  ).size;

  const nextSplitDay = splitDayNames.find(
    (name) => !(weekSessions ?? []).some((s) => s.split_day === name),
  );

  const parts: string[] = [];

  if (lastSleep?.hours != null) {
    const desc = lastSleep.woke_feeling
      ? (WAKE_DESCRIPTIONS[lastSleep.woke_feeling] ?? "")
      : "";
    parts.push(
      `${lastSleep.hours} hours last night${
        lastSleep.woke_feeling ? ` and you woke up feeling ${lastSleep.woke_feeling.toLowerCase()}` : ""
      }${desc ? ` — ${desc}` : ""}.`,
    );
  } else {
    parts.push("No sleep logged yet — log last night to get a real recovery read here.");
  }

  if ((weekSessions ?? []).length > 0 || totalSplitDays > 0) {
    parts.push(
      `You've done ${splitDaysDoneThisWeek} of ${totalSplitDays} split days this week${
        nextSplitDay ? `, ${nextSplitDay} still on deck` : ""
      }.`,
    );
  }

  if (target) {
    parts.push(
      `TDEE is holding at ~${Math.round(target.tdee_kcal)}, so the ${Math.round(target.target_kcal)} kcal target is giving you a ${
        target.phase === "cut" ? "clean deficit" : target.phase === "bulk" ? "clean surplus" : "maintenance target"
      }.`,
    );
  } else {
    parts.push("No nutrition targets set yet — set those up in Settings to get real numbers here.");
  }

  const message = parts.join(" ");

  return (
    <div className="flex h-full flex-col px-5 pt-[30px] pb-[110px]">
      <p className="text-muted mb-0.5 text-[15px]">Weekly Check-in</p>
      <h1 className="font-display mb-4.5 text-[26px] font-extrabold tracking-tight">
        Coach
      </h1>

      <div className="border-border rounded-2xl rounded-tl-[4px] border bg-surface p-4 text-[15px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        {message}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/progress"
          className="bg-[#E7F1F7] text-blue whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium"
        >
          How am I doing?
        </Link>
        <Link
          href="/settings/goals"
          className="bg-[#E7F1F7] text-blue whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium"
        >
          Adjust my target
        </Link>
        <Link
          href="/settings/goals"
          className="bg-[#E7F1F7] text-blue whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium"
        >
          Explain my TDEE
        </Link>
      </div>

      <div className="flex-1" />

      <div className="border-border bg-surface text-muted flex items-center justify-between rounded-3xl border px-4 py-3 opacity-60 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
        <span className="text-[15px]">Ask your coach anything…</span>
        <span className="text-xs font-semibold">Not available yet</span>
      </div>
    </div>
  );
}
