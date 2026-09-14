import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SleepEntryForm } from "./sleep-entry-form";

export default async function LogSleepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="px-5 pt-[24px] pb-8">
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
        <span className="text-muted text-[15px]">Overview</span>
      </div>
      <h1 className="font-display mt-1 mb-5 text-2xl font-extrabold tracking-tight">
        Log sleep · last night
      </h1>

      <SleepEntryForm defaultHours={7.5} />
    </div>
  );
}
