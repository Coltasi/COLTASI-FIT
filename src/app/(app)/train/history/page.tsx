import Link from "next/link";
import { BackHeader, SectionLabel } from "@/components/ui";
import { IconChevron } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtDay, mondayOf } from "@/lib/dates";

const FILTERS = [
  { k: "all", l: "All" }, { k: "split", l: "The Split" }, { k: "kettlebell", l: "Kettlebell" }, { k: "custom", l: "Custom" },
];

export default async function HistoryPage({ searchParams }: PageProps<"/train/history">) {
  const sp = await searchParams;
  const f = typeof sp.f === "string" && FILTERS.some((x) => x.k === sp.f) ? sp.f : "all";
  const { supabase, today } = await getContext();
  let q = supabase
    .from("sessions")
    .select("id, kind, title, session_date, status, session_exercises(id, exercises(name), session_sets(done))")
    .neq("status", "in_progress")
    .order("session_date", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(80);
  if (f !== "all") q = q.eq("kind", f);
  const { data } = await q;

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
              const all = ses.length;
              const tag = s.status === "skipped" ? ["Skipped", "dashed"]
                : s.kind === "custom" ? ["Custom", "ember"]
                : s.kind === "kettlebell" ? ["Kettlebell", "cream"]
                : logged.length < all ? ["Partial", "neutral"] : ["Done", "blue"];
              const meta = s.kind === "custom"
                ? logged.slice(0, 2).map((x) => x.exercises?.name).join(", ") + (logged.length > 2 ? ` + ${logged.length - 2}` : "")
                : `${logged.length} of ${all} lifts`;
              return (
                <Link key={s.id} href={`/train/session/${s.id}`} className="row" style={{ paddingRight: 14 }}>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <p className="ln">{s.title}</p>
                    <p className="cap">{fmtDay(s.session_date)}{meta ? ` · ${meta}` : ""}</p>
                  </div>
                  <span className={`tag ${tag[1]}`}>{tag[0]}</span>
                  <IconChevron />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.size ? <p className="cap" style={{ textAlign: "center", marginTop: 24 }}>No sessions yet. Your first one shows up here.</p> : (
        <p className="cap" style={{ textAlign: "center" }}>Tap a session to see every set you logged.</p>
      )}
    </main>
  );
}
