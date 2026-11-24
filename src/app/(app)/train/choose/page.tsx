import Link from "next/link";
import { BackHeader } from "@/components/ui";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { fmtDow, fmtShort } from "@/lib/dates";
import { startCustom } from "../actions";
import { CustomButton } from "./custom-button";

export default async function ChoosePage() {
  const { supabase, today } = await getContext();
  const programP = getProgram(supabase);
  const [program, week, { data: lastDone }] = await Promise.all([
    programP,
    getWeekState(supabase, today, programP),
    supabase.from("sessions").select("day_id, session_date").eq("status", "done").not("day_id", "is", null).order("session_date", { ascending: false }).limit(60),
  ]);
  const lastByDay = new Map<string, string>();
  for (const r of (lastDone ?? []) as any[]) if (!lastByDay.has(r.day_id)) lastByDay.set(r.day_id, r.session_date);

  const Row = ({ d }: { d: (typeof program)[number] }) => {
    const doneOn = week.done.get(d.id);
    const next = week.nextDay?.id === d.id;
    return (
      <Link href={`/train?day=${d.id}`} className="row" style={next ? { background: "var(--tint-ember-soft)" } : undefined}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: next ? "7px solid var(--ember)" : "1.5px solid var(--check-line)" }} />
        <span style={{ flexGrow: 1 }}>
          <span className="ln" style={{ display: "block" }}>{d.name}</span>
          <span className="cap">{d.exercises.length} lifts{lastByDay.get(d.id) ? ` · last ${fmtShort(lastByDay.get(d.id)!)}` : ""}</span>
        </span>
        {doneOn ? <span className="tag neutral">Done {fmtDow(doneOn)}</span> : next ? <span className="tag ember">Next up</span> : null}
      </Link>
    );
  };

  return (
    <main className="screen">
      <BackHeader href="/train" label="Train" title="Choose workout" />
      <div className="card clip">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 16px 10px" }}>
          <p className="ln" style={{ fontSize: 17 }}>The Split</p>
          <p className="cap" style={{ fontSize: 14 }}>{program.filter((d) => d.program === "split").length} days</p>
        </div>
        {program.filter((d) => d.program === "split").map((d) => <Row key={d.id} d={d} />)}
      </div>
      <div className="card clip">
        <div style={{ padding: "14px 16px 10px" }}><p className="ln" style={{ fontSize: 17 }}>Kettlebell</p></div>
        {program.filter((d) => d.program === "kettlebell").map((d) => <Row key={d.id} d={d} />)}
      </div>
      <form action={startCustom}>
        <CustomButton />
      </form>
    </main>
  );
}
