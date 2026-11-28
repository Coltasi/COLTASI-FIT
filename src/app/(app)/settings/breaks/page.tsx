import Link from "next/link";
import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { breakLabel, getBreaks } from "@/lib/breaks";
import { fmtShort } from "@/lib/dates";
import { BreakForm } from "./break-form";
import { deleteBreak } from "./actions";

export default async function BreaksPage({ searchParams }: PageProps<"/settings/breaks">) {
  const sp = await searchParams;
  const { supabase, today } = await getContext();
  const breaks = await getBreaks(supabase);
  const editing = typeof sp.edit === "string" ? breaks.find((b) => b.id === sp.edit) ?? null : null;
  // Finished breaks drop off the list; current and upcoming ones stay.
  const shown = breaks.filter((b) => b.end_date >= today);

  return (
    <main className="screen" style={{ gap: 20 }}>
      <BackHeader href="/settings" label="Settings" title="Breaks" />
      <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.45 }}>
        Away from the gym? Set the dates and how many workouts you want. The app switches to kettlebell workouts for your 8 kg and 12 kg bells, and maintenance calories.
      </p>

      {shown.map((b) => {
        const live = b.start_date <= today;
        return (
          <section key={b.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 className="sec">{breakLabel(b)}</h2>
              <span className={`tag ${live ? "ember" : "blue"}`}>{live ? "On now" : "Upcoming"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
              <div className="stat"><span>Dates</span><p style={{ fontSize: 17, fontWeight: 700 }}>{fmtShort(b.start_date)} to {fmtShort(b.end_date)}</p></div>
              <div className="stat"><span>Target</span><p style={{ fontSize: 17, fontWeight: 700 }}>{b.workouts_per_week} {b.workouts_per_week === 1 ? "workout" : "workouts"} / week</p></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
              <Link prefetch={false} href={`/settings/breaks?edit=${b.id}`} className="ghost">Edit</Link>
              <form action={deleteBreak}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className="ghost" style={{ color: "var(--crimson)" }}>Delete</button>
              </form>
            </div>
          </section>
        );
      })}

      <BreakForm key={editing?.id ?? "new"} editing={editing} />
    </main>
  );
}
