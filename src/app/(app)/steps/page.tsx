import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { addDays, fmtDay, fmtShort } from "@/lib/dates";
import { fmtSteps, getSteps, stepSummary } from "@/lib/steps";
import { deleteSteps } from "./actions";
import { StepsForm } from "./steps-form";

export default async function StepsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { supabase, today } = await getContext();
  const { d } = await searchParams;
  const rows = await getSteps(supabase, today, 60);
  const byDay = new Map(rows.map((r) => [r.day, r.steps]));
  const s = stepSummary(rows, today);
  const initialDay = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && d >= addDays(today, -60) ? d : today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).map((day, i) => ({
    day, label: i === 0 ? "Today" : i === 1 ? "Yesterday" : fmtDay(day), steps: byDay.get(day) ?? null,
  }));
  if (!days.some((x) => x.day === initialDay)) days.push({ day: initialDay, label: fmtDay(initialDay), steps: byDay.get(initialDay) ?? null });
  const list = [...rows].reverse();

  return (
    <main className="screen">
      <BackHeader href="/" label="Today" eyebrow="Garmin" title="Steps" />
      <div className="card" style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><div className="num" style={{ fontSize: 22 }}>{s.avg7 != null ? fmtSteps(s.avg7) : "–"}</div><p className="cap">7-day avg{s.avg7 == null ? " (needs 3 days)" : ""}</p></div>
        <div><div className="num" style={{ fontSize: 22 }}>{s.avgPrev7 != null ? fmtSteps(s.avgPrev7) : "–"}</div><p className="cap">Week before</p></div>
      </div>
      <StepsForm key={initialDay} days={days} initialDay={initialDay} next="/steps" />
      <div className="card clip">
        <div style={{ padding: "12px 16px" }}><p className="lab">History</p></div>
        {list.map((r) => (
          <div key={r.day} className="row">
            <a href={`/steps?d=${r.day}`} style={{ flexGrow: 1, color: "inherit" }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{fmtDay(r.day)}{r.day === today ? " · so far" : ""}</p>
            </a>
            <span className="num" style={{ fontSize: 16 }}>{fmtSteps(r.steps)}</span>
            <form action={deleteSteps}>
              <input type="hidden" name="day" value={r.day} />
              <button type="submit" aria-label={`Delete ${fmtShort(r.day)}`} style={{ background: "none", border: 0, color: "var(--muted)", fontSize: 18, cursor: "pointer" }}>×</button>
            </form>
          </div>
        ))}
        {!list.length ? <p className="cap" style={{ padding: "0 16px 14px" }}>No steps logged yet.</p> : null}
      </div>
    </main>
  );
}
