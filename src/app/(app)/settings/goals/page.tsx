import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoalsForm } from "./goals-form";

export default async function SettingsGoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: scan }, { data: target }] = await Promise.all([
    supabase.from("profiles").select("sex").eq("id", user.id).single(),
    supabase
      .from("body_comp_scans")
      .select("weight_kg, body_fat_pct, scanned_at")
      .eq("user_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", user.id)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const canCalculate = !!profile?.sex && !!scan?.weight_kg && scan?.body_fat_pct != null;

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
      <h1 className="font-display mt-1 mb-1 text-2xl font-extrabold tracking-tight">
        Program &amp; Goals
      </h1>
      <p className="text-muted mb-5 text-[13px]">
        Calculated from your sex (Profile) and your latest body-comp scan
        {scan ? ` — ${scan.weight_kg} kg, ${scan.body_fat_pct}% body fat` : ""}.
      </p>

      {target && (
        <div className="border-border bg-surface mb-5 rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
          <p className="mb-2.5 text-[15px] font-semibold">Current targets · {target.phase}</p>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-display text-[19px] font-extrabold">
              {target.target_kcal} kcal
            </span>
            <span className="text-muted text-xs">TDEE {target.tdee_kcal}</span>
          </div>
          <p className="text-muted text-[13px]">
            {target.target_protein_g}g protein · {target.target_carbs_g}g carbs ·{" "}
            {target.target_fat_g}g fat
          </p>
        </div>
      )}

      {canCalculate ? (
        <GoalsForm defaultRate={target?.target_rate_kg_per_week ?? -0.5} />
      ) : (
        <p className="text-muted text-[14px]">
          Set your sex in{" "}
          <Link href="/settings/profile" className="text-blue font-semibold">
            Profile
          </Link>{" "}
          and log at least one{" "}
          <Link href="/progress/scan" className="text-blue font-semibold">
            body-comp scan
          </Link>{" "}
          with weight and body fat % before targets can be calculated.
        </p>
      )}
    </div>
  );
}
