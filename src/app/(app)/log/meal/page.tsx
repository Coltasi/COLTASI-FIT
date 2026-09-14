import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MealCaptureForm } from "./meal-capture-form";

export default async function LogMealPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="px-5 pt-[24px] pb-8">
      <div className="flex items-center gap-2.5">
        <Link href="/log">
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
        <span className="text-muted text-[15px]">Log</span>
      </div>
      <h1 className="font-display mt-1 mb-4.5 text-2xl font-extrabold tracking-tight">
        Log a meal
      </h1>

      <MealCaptureForm />
    </div>
  );
}
