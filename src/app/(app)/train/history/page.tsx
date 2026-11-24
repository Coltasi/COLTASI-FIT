import Link from "next/link";
import { BackHeader, SectionLabel } from "@/components/ui";
import { IconChevron } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtDay, mondayOf } from "@/lib/dates";
import { EffortTag } from "@/components/effort";
import { EFFORT_LABEL, gradeSession, isEffort } from "@/lib/effort";

const FILTERS = [
  { k: "all", l: "All" }, { k: "split", l: "The Split" }, { k: "kettlebell", l: "Kettlebell" }, { k: "custom", l: "Custom" },
];

export default async function HistoryPage({ searchParams }: PageProps<"/train/history">) {
  const sp = await searchParams;
  const f = typeof sp.f === "string" && FILTERS.some((x) => x.k === sp.f) ? sp.f : "all";
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const { supabase, today } = await getContext();
  let q = supabase
    .from("sessions")
    .select("id, kind, title, session_date, status, effort, session_exercises(id, skipped_reason, skill, exercises(name), session_sets(done))")
    .neq("status", "in_progress")
    .order("session_date", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(80);
  if (f !== "all") q = q.eq("kind", f);
  if (day) q = q.eq("session_date", day);
  const { data } = await q;
  // The Coach's honest grade per workout, from the read written after it.
  const ids = ((data ?? []) as any[]).map((s) => s.id);
  const { data: reads } = ids.length
    ? await supabase.from("coach_reads").select("source_id, signals").eq("kind", "session").in("source_id", ids).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const liftsBySession = new Map<string, any>();
  for (const r of (reads ?? []) as any[]) if (!liftsBySession.has(r.source_id)) liftsBySession.set(r.source_id, r.signals?.lifts);

  const thisMon = mondayOf(today);
  const groups = new Map<string, any[]>();
  for (const s of (data ?? []) as any[]) {
    const mon = mondayOf(s.session_date);
    const label = mon === thisMon ? "This week" : mon === addDays(thisMon, -7) ? "Last week" : `Week of ${fmtDay(mon)}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }

  return (
    <main className="screen">
      <BackHeader href="/train" label="Train" title="History" />
      {day ? (
        <div className="card cream" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
          <span className="ln" style={{ fontSize: 14 }}>{fmtDay(day)}</span>
          <Link href="/train/history" style={{ fontSize: 14, fontWeight: 600 }}>Show all</Link>
        </div>
      ) : null}
      <div className="chips">
        {FILTERS.map((x) => (
          <Link key={x.k} href={x.k === "all" ? "/train/history" : `/train/history?f=${x.k}`} className={`chip${f === x.k ? " on" : ""}`} aria-current={f === x.k ? "page" : undefined}>{x.l}</Link>
        ))}
      </div>
      {[...groups.entries()].map(([label, list]) => (
        <div key={label}>
          <SectionLabel>{label}</SectionLabel>
          <div className="card clip">
            {list.map((s) => {
              const ses = (s.session_exercises ?? []) as any[];
              const logged = ses.filter((x) => (x.session_sets ?? []).some((z: any) => z.done));
              const skipped = ses.filter((x) => x.skipped_reason).length;
              const all = ses.length - skipped;
              const tag = s.status === "skipped" ? ["Skipped", "dashed"]
                : s.kind === "custom" ? ["Custom", "ember"]
                : s.kind === "kettlebell" ? ["Kettlebell", "cream"]
                : logged.length < all ? ["Partial", "neutral"] : ["Done", "blue"];
              const meta = s.kind === "custom"
                ? logged.slice(0, 2).map((x) => x.exercises?.name).join(", ") + (logged.length > 2 ? ` + ${logged.length - 2}` : "")
                : `${logged.length} of ${all} lifts${skipped ? ` · ${skipped} skipped` : ""}`;
              const grade = s.status === "done" ? gradeSession(liftsBySession.get(s.id), ses.filter((x) => x.skipped_reason && !x.skill).length)?.grade : null;
              const mine = isEffort(s.effort) ? EFFORT_LABEL[s.effort as keyof typeof EFFORT_LABEL] : null;
              return (
                <Link key={s.id} href={`/train/session/${s.id}`} className="row" style={{ paddingRight: 14 }}>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <p className="ln">{s.title}</p>
                    <p className="cap">{fmtDay(s.session_date)}{meta ? ` · ${meta}` : ""}{mine ? ` · You: ${mine}` : ""}</p>
                  </div>
                  {grade ? <EffortTag grade={grade} /> : <span className={`tag ${tag[1]}`}>{tag[0]}</span>}
                  <IconChevron />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.size ? <p className="cap" style={{ textAlign: "center", marginTop: 24 }}>{day ? "No workout logged that day." : "No sessions yet. Your first one shows up here."}</p> : (
        <p className="cap" style={{ textAlign: "center" }}>Tap a session to see every set you logged.</p>
      )}
    </main>
  );
}
