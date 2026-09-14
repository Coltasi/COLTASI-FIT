import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Exports everything the signed-in user owns as one JSON file. This is a
// personal-data export, not a program/library export - shared reference
// tables (exercises, program_days, program_exercises) aren't included since
// they aren't "my data," they're the same for every household member.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    profile,
    bodyCompScans,
    bodyCompScanPhotos,
    workoutSessions,
    workoutSets,
    meals,
    nutritionTargets,
    sleepLogs,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("body_comp_scans").select("*").eq("user_id", user.id),
    supabase
      .from("body_comp_scan_photos")
      .select("*, body_comp_scans!inner(user_id)")
      .eq("body_comp_scans.user_id", user.id),
    supabase.from("workout_sessions").select("*").eq("user_id", user.id),
    supabase
      .from("workout_sets")
      .select("*, workout_sessions!inner(user_id)")
      .eq("workout_sessions.user_id", user.id),
    supabase.from("meals").select("*").eq("user_id", user.id),
    supabase.from("nutrition_targets").select("*").eq("user_id", user.id),
    supabase.from("sleep_logs").select("*").eq("user_id", user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    profile: profile.data ?? null,
    body_comp_scans: bodyCompScans.data ?? [],
    body_comp_scan_photos: bodyCompScanPhotos.data ?? [],
    workout_sessions: workoutSessions.data ?? [],
    workout_sets: workoutSets.data ?? [],
    meals: meals.data ?? [],
    nutrition_targets: nutritionTargets.data ?? [],
    sleep_logs: sleepLogs.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="coltasi-fit-export-${date}.json"`,
    },
  });
}
