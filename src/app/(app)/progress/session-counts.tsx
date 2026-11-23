import Link from "next/link";
import type { Supa } from "@/lib/data";
import { mondayOf } from "@/lib/dates";

/** Finished workouts (any kind) this week and all time. Shown on both Progress tabs. */
export async function SessionCounts({ supabase, today }: { supabase: Supa; today: string }) {
  const monday = mondayOf(today);
  const [{ count: week }, { count: total }] = await Promise.all([
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "done").gte("session_date", monday),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "done"),
  ]);

  return (
    <Link href="/train/history" className="card" aria-label="Workouts completed, open session history"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "16px 18px", color: "var(--navy)" }}>
      <div className="stat"><b>{week ?? 0}</b><span>workouts this week</span></div>
      <div className="stat"><b>{total ?? 0}</b><span>all time</span></div>
    </Link>
  );
}
