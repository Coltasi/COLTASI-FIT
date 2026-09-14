import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function SettingsProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, sex, birth_date, height_cm")
    .eq("id", user.id)
    .single();

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
        Profile
      </h1>

      <ProfileForm
        defaultDisplayName={profile?.display_name ?? ""}
        defaultSex={profile?.sex ?? ""}
        defaultBirthDate={profile?.birth_date ?? ""}
        defaultHeightCm={profile?.height_cm ?? null}
      />
    </div>
  );
}
