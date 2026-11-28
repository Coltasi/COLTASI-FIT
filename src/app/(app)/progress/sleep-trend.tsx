import Link from "next/link";
import type { Supa } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { SleepChart, type SleepNight } from "./sleep-chart";

/** Progress → Body: loads up to two years of sleep (enough for 1Y and the year before it) for the range chart. */
export async function SleepTrend({ supabase, today }: { supabase: Supa; today: string }) {
  const last = addDays(today, -1); // last night
  const { data } = await supabase.from("sleep_logs").select("night_of, hours").gte("night_of", addDays(last, -730)).lte("night_of", last).order("night_of");
  const nights: SleepNight[] = ((data ?? []) as { night_of: string; hours: number | string | null }[])
    .filter((r) => r.hours != null).map((r) => ({ night: r.night_of, hours: Number(r.hours) }));

  if (!nights.length) {
    return (
      <div className="card" style={{ padding: "16px 18px" }}>
        <p className="sec">Sleep</p>
        <p className="cap" style={{ marginTop: 6 }}>Log your sleep to see your trend here.</p>
        <Link prefetch={false} href="/sleep" className="pill" style={{ marginTop: 12 }}>Log sleep</Link>
      </div>
    );
  }
  return <SleepChart nights={nights} lastNight={last} />;
}
