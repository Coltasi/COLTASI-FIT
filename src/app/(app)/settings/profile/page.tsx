import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const { profile } = await getContext();
  return (
    <main className="screen">
      <BackHeader href="/settings" label="Settings" title="Body stats & goals" />
      <ProfileForm profile={profile} />
    </main>
  );
}
