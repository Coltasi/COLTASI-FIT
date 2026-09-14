import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { updateUnits } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, sex, height_cm, birth_date, units, household_id")
    .eq("id", user.id)
    .single();

  const [{ data: householdMembers }, { data: target }] = await Promise.all([
    profile?.household_id
      ? supabase.from("profiles").select("id").eq("household_id", profile.household_id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("nutrition_targets")
      .select("phase, target_rate_kg_per_week")
      .eq("user_id", user.id)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const otherMembers = Math.max(0, (householdMembers ?? []).length - 1);
  const initial = (profile?.display_name || user.email || "?").charAt(0).toUpperCase();

  const profileSummary =
    profile?.sex || profile?.height_cm || profile?.birth_date
      ? "set"
      : "used for TDEE";

  return (
    <div className="px-5 pt-[24px] pb-8">
      <div className="flex items-center gap-2.5">
        <Link href="/">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="text-muted text-[15px]">Overview</span>
      </div>
      <h1 className="font-display mt-1 mb-5 text-2xl font-extrabold tracking-tight">
        Settings
      </h1>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Account</p>
      <div className="mb-4.5 flex flex-col gap-2.5">
        <Link
          href="/settings/profile"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center gap-2.5">
            <div className="bg-[#E7F1F7] text-blue font-display flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
              {initial}
            </div>
            <div>
              <span className="block text-[15px] font-semibold">
                {profile?.display_name || "Add your name"}
              </span>
              <span className="text-muted text-[13px]">{user.email}</span>
            </div>
          </div>
          <span className="text-muted-2">›</span>
        </Link>
        <Link
          href="/settings/household"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <span className="text-[15px] font-semibold">Manage household</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted text-[13px]">
              {otherMembers > 0 ? `${otherMembers} other login${otherMembers === 1 ? "" : "s"}` : "just you"}
            </span>
            <span className="text-muted-2">›</span>
          </div>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="border-border bg-surface text-danger w-full rounded-xl border px-4 py-3.5 text-left text-[15px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Profile</p>
      <div className="mb-4.5 flex flex-col gap-2.5">
        <Link
          href="/settings/profile"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <span className="text-[15px] font-semibold">Height, sex, age</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted text-[13px]">{profileSummary}</span>
            <span className="text-muted-2">›</span>
          </div>
        </Link>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Units</p>
      <div className="mb-4.5">
        <div className="bg-border flex rounded-[10px] p-[3px]">
          <form action={updateUnits.bind(null, "imperial")} className="flex-1">
            <button
              type="submit"
              className={`w-full rounded-[7px] py-1.5 text-[13px] ${
                profile?.units === "imperial" ? "bg-surface font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted"
              }`}
            >
              Imperial (lb)
            </button>
          </form>
          <form action={updateUnits.bind(null, "metric")} className="flex-1">
            <button
              type="submit"
              className={`w-full rounded-[7px] py-1.5 text-[13px] ${
                profile?.units !== "imperial" ? "bg-surface font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted"
              }`}
            >
              Metric (kg)
            </button>
          </form>
        </div>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Program &amp; Goals</p>
      <div className="mb-4.5 flex flex-col gap-2.5">
        <Link
          href="/settings/goals"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <span className="text-[15px] font-semibold">Current phase</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted text-[13px]">{target?.phase ?? "Not set"}</span>
            <span className="text-muted-2">›</span>
          </div>
        </Link>
        <Link
          href="/settings/goals"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <span className="text-[15px] font-semibold">Target rate</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted text-[13px]">
              {target?.target_rate_kg_per_week != null
                ? `${target.target_rate_kg_per_week > 0 ? "+" : ""}${target.target_rate_kg_per_week} kg/wk`
                : "Not set"}
            </span>
            <span className="text-muted-2">›</span>
          </div>
        </Link>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Notifications</p>
      <div className="mb-4.5 flex flex-col gap-2.5">
        <div className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 opacity-60 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
          <span className="text-[15px] font-semibold">Workout day reminder</span>
          <span className="text-muted text-[13px]">Not available yet</span>
        </div>
        <div className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 opacity-60 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
          <span className="text-[15px] font-semibold">Weekly check-in</span>
          <span className="text-muted text-[13px]">Not available yet</span>
        </div>
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Data</p>
      <div className="flex flex-col gap-2.5">
        <a
          href="/settings/export"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <span className="text-[15px] font-semibold">Export my data</span>
          <span className="text-muted-2">›</span>
        </a>
        <Link
          href="/settings/about"
          className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
        >
          <span className="text-[15px] font-semibold">About Coltasi Fit</span>
          <span className="text-muted-2">›</span>
        </Link>
      </div>
    </div>
  );
}
