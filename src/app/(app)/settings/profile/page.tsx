import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { ProfileForm, type LatestScan } from "./profile-form";

export default async function ProfilePage() {
  const { supabase, profile } = await getContext();
  const { data } = await supabase.from("scans").select("scanned_on, weight_kg, body_fat_pct")
    .not("weight_kg", "is", null).not("body_fat_pct", "is", null)
    .order("scanned_on", { ascending: false }).limit(1);
  const s = data?.[0];
  const scan: LatestScan | null = s ? { on: s.scanned_on, weightKg: Number(s.weight_kg), bodyFat: Number(s.body_fat_pct) } : null;
  return (
    <main className="screen">
      <BackHeader href="/settings" label="Settings" title="Body stats & goals" />
      <ProfileForm profile={profile} scan={scan} />
    </main>
  );
}
