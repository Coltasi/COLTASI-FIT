import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions/auth";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name, household_id")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-14 text-center">
      <Image
        src="/icons/icon-192.png"
        alt="Coltasi Fit"
        width={64}
        height={64}
        className="rounded-2xl"
      />
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          You&apos;re in, {profile?.display_name || user?.email}
        </h1>
        <p className="text-muted mt-2 max-w-xs text-sm leading-relaxed">
          Real auth and your database are wired up. The actual app screens
          (workouts, nutrition, progress) are next.
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="text-danger text-sm font-semibold"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
