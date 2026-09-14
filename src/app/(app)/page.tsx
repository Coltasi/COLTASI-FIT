import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatEyebrowDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // proxy.ts already redirects unauthenticated requests

  const today = todayIso();
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: profile },
    { data: target },
    { data: todaySession },
    { data: sleepLogs },
    { data: todaysMeals },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", user.id)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("*, workout_sets(count)")
      .eq("user_id", user.id)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sleep_logs")
      .select("log_date, hours")
      .eq("user_id", user.id)
      .gte("log_date", weekAgo)
      .order("log_date", { ascending: true }),
    supabase
      .from("meals")
      .select("calories")
      .eq("user_id", user.id)
      .gte("logged_at", todayStart.toISOString()),
  ]);

  const loggedKcal = (todaysMeals ?? []).reduce(
    (sum, m) => sum + (m.calories ?? 0),
    0,
  );

  const lastNight = sleepLogs?.at(-1);
  const weekAvgHours =
    sleepLogs && sleepLogs.length > 0
      ? sleepLogs.reduce((sum, s) => sum + (s.hours ?? 0), 0) / sleepLogs.length
      : null;
  const maxHours = Math.max(1, ...(sleepLogs ?? []).map((s) => s.hours ?? 0));

  return (
    <div className="px-[18px] pt-[26px]">
      <div className="mb-[18px] flex items-center gap-2.5">
        <Image
          src="/icons/icon-192.png"
          alt="Coltasi Fit"
          width={38}
          height={38}
          className="rounded-[10px]"
        />
        <span className="font-display text-base font-extrabold tracking-wide uppercase">
          Coltasi Fit
        </span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted mb-0.5 text-[13px] font-semibold">
            {formatEyebrowDate()}
          </p>
          <h1 className="font-display mb-1.5 text-[26px] font-extrabold tracking-tight">
            Overview
          </h1>
        </div>
        <Link href="/settings" aria-label="Settings" className="mt-1.5">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
          </svg>
        </Link>
      </div>
      <p className="text-muted mb-[18px] text-[13px]">
        Signed in as {profile?.display_name || user.email}
      </p>

      <div className="mb-3.5 rounded-[18px] border border-[#D9E7EF] bg-gradient-to-br from-[#E8F1F6] to-[#F2F8FA] p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <p className="mb-2 text-[15px] font-bold">Coach says</p>
        <p className="text-[14px] leading-relaxed">
          Nothing logged yet — once you&apos;ve tracked a workout, a meal, or
          last night&apos;s sleep, Coach will start noticing patterns here.
        </p>
        <div className="mt-2.5 text-right">
          <Link href="/coach" className="text-blue text-[13px] font-semibold">
            Ask Coach →
          </Link>
        </div>
      </div>

      <div className="border-border bg-surface mb-3.5 rounded-[18px] border p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[15px] font-bold">Energy</p>
          {target ? (
            <span className="text-muted text-[13px]">
              TDEE {Math.round(target.tdee_kcal)} · target{" "}
              {Math.round(target.target_kcal)}
            </span>
          ) : null}
        </div>

        {target ? (
          <>
            <div className="flex gap-4 text-[13px]">
              <span>
                <span className="bg-blue mr-1.5 inline-block h-2 w-2 rounded-full" />
                {target.target_protein_g}g protein
              </span>
              <span>
                <span className="bg-teal mr-1.5 inline-block h-2 w-2 rounded-full" />
                {target.target_carbs_g}g carbs
              </span>
              <span>
                <span className="bg-orange mr-1.5 inline-block h-2 w-2 rounded-full" />
                {target.target_fat_g}g fat
              </span>
            </div>
            <div className="mt-2.5 text-right">
              <Link href="/log" className="text-blue text-[13px] font-semibold">
                {loggedKcal} kcal logged · Log meal →
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted text-[13px]">
              No targets set yet — add your TDEE and macro targets to start
              tracking energy balance.
            </p>
            <div className="mt-2.5 text-right">
              <Link
                href="/settings"
                className="text-blue text-[13px] font-semibold"
              >
                Set up targets →
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="border-border bg-surface mb-3.5 rounded-[18px] border p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        {lastNight ? (
          <>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-display text-[21px] font-extrabold">
                  {lastNight.hours} hrs
                </span>
                <span className="text-muted ml-1.5 text-[13px]">
                  last night
                </span>
              </div>
              {weekAvgHours !== null && (
                <span className="text-muted text-[13px]">
                  avg {weekAvgHours.toFixed(1)} hrs this week
                </span>
              )}
            </div>
            <div className="mt-3.5 flex h-10 items-end gap-1.5">
              {(sleepLogs ?? []).map((s, i) => (
                <div
                  key={i}
                  className="w-full rounded"
                  style={{
                    height: `${Math.max(10, ((s.hours ?? 0) / maxHours) * 100)}%`,
                    background: i === sleepLogs!.length - 1 ? "#1FA6C9" : "#D9EEF4",
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted text-[13px]">No sleep logged yet.</p>
        )}
        <div className="mt-2.5 text-right">
          <Link href="/log" className="text-blue text-[13px] font-semibold">
            Log sleep →
          </Link>
        </div>
      </div>

      <div className="border-border bg-surface rounded-[18px] border p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <p className="text-[15px] font-bold">
              {todaySession
                ? todaySession.split_day || todaySession.session_type
                : "Nothing scheduled"}
            </p>
            <p className="text-muted text-[13px]">
              {todaySession
                ? `${todaySession.session_type === "split" ? "The Split" : todaySession.session_type} · ${
                    todaySession.workout_sets?.[0]?.count ?? 0
                  } exercises`
                : "No workout logged for today yet"}
            </p>
          </div>
          <span className="bg-[#E7F1F7] text-blue rounded-full px-2.5 py-1 text-xs font-semibold">
            {todaySession?.completed_at ? "Completed" : "Not started"}
          </span>
        </div>
        <div className="mt-3 text-right">
          <Link href="/train" className="text-blue text-[13px] font-semibold">
            See in Train →
          </Link>
        </div>
      </div>

      <form action={signOut} className="mt-8 pb-4 text-center">
        <button type="submit" className="text-danger text-[13px] font-semibold">
          Sign out
        </button>
      </form>
    </div>
  );
}
