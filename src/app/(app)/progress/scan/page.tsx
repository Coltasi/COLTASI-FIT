import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScanForm } from "./scan-form";

export default async function LogScanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="px-5 pt-[24px] pb-8">
      <div className="flex items-center gap-2.5">
        <Link href="/progress">
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
        <span className="text-muted text-[15px]">Progress</span>
      </div>
      <h1 className="font-display mt-1 mb-4.5 text-2xl font-extrabold tracking-tight">
        Log a scan · {today}
      </h1>

      <ScanForm />
    </div>
  );
}
