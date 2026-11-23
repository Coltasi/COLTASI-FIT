import Link from "next/link";
import type { Supa } from "@/lib/data";
import { fmtShort, mondayOf } from "@/lib/dates";

/** Finished workouts (any kind: split, kettlebell, custom) this week and to date. Shown on both Progress tabs. */
export async function SessionCounts({ supabase, today }: { supabase: Supa; today: string }) {
  const monday = mondayOf(today);
  const [{ count: week }, { count: total }, { data: firstRow }] = await Promise.all([
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "done").gte("session_date", monday),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "done"),
    supabase.from("sessions").select("session_date").eq("status", "done").order("session_date").limit(1),
  ]);
  const first = (firstRow?.[0] as { session_date?: string } | undefined)?.session_date;
  const tiles = [
    { l: "This week", v: week ?? 0, cap: `since Mon ${fmtShort(monday)}` },
    { l: "All time", v: total ?? 0, cap: first ? `since ${fmtShort(first)}` : "none yet" },
  ];

  return (
    <Link href="/train/history" className="card" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", color: "var(--navy)" }} aria-label="Workouts completed, open session history">
      {tiles.map((t, i) => (
        <div key={t.l} style={{ padding: "14px 16px", borderLeft: i ? "1px solid var(--line-soft)" : undefined }}>
          <p className="lab">{t.l}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span className="num" style={{ fontSize: 28 }}>{t.v}</span>
            <span className="cap">{t.v === 1 ? "workout" : "workouts"}</span>
          </div>
          <p className="cap">{t.cap}</p>
        </div>
      ))}
    </Link>
  );
}
