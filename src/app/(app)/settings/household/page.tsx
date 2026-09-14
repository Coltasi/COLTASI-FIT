import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsHouseholdPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  let members: { id: string; display_name: string | null }[] = [];
  let inviteCode: string | null = null;

  if (profile?.household_id) {
    const [{ data: memberRows }, { data: household }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("household_id", profile.household_id),
      supabase
        .from("households")
        .select("invite_code")
        .eq("id", profile.household_id)
        .single(),
    ]);
    members = memberRows ?? [];
    inviteCode = household?.invite_code ?? null;
  }

  const others = members.filter((m) => m.id !== user.id);

  return (
    <div className="px-5 pt-[24px] pb-8">
      <div className="flex items-center gap-2.5">
        <Link href="/settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="text-muted text-[15px]">Settings</span>
      </div>
      <h1 className="font-display mt-1 mb-5 text-2xl font-extrabold tracking-tight">
        Household
      </h1>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Members</p>
      <div className="mb-4.5 flex flex-col gap-2.5">
        <div className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
          <span className="text-[15px] font-semibold">
            {"You"}
          </span>
          <span className="text-muted text-[13px]">You</span>
        </div>
        {others.map((m) => (
          <div
            key={m.id}
            className="border-border bg-surface flex items-center justify-between rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
          >
            <span className="text-[15px] font-semibold">
              {m.display_name || "Household member"}
            </span>
          </div>
        ))}
        {others.length === 0 && (
          <p className="text-muted text-[13px]">
            No one else has joined your household yet.
          </p>
        )}
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">Invite</p>
      <div className="border-border bg-surface rounded-xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
        {inviteCode ? (
          <>
            <p className="text-[13px] text-muted mb-1.5">
              Share this code so someone else can sign up under your household and see the same shared data.
            </p>
            <p className="font-display text-2xl font-extrabold tracking-widest">
              {inviteCode}
            </p>
          </>
        ) : (
          <p className="text-muted text-[13px]">
            No household is set up on your account yet.
          </p>
        )}
      </div>
    </div>
  );
}
