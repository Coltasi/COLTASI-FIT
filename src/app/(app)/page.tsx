import Link from "next/link";
import { BrandRow, CoachMark } from "@/components/ui";
import { InstallCard } from "@/components/install-card";
import { IconChevron, IconGear } from "@/components/icons";
import { getContext, getProgram, getWeekState } from "@/lib/data";
import { addDays, fmtDow, fmtLong } from "@/lib/dates";

const FEEL: Record<string, string> = { energetic: "woke energetic", rested: "woke rested", groggy: "woke groggy", tired: "woke tired", exhausted: "woke exhausted" };

export default async function OverviewPage() {
  const { supabase, today } = await getContext();
  const programP = getProgram(supabase);
  const [program, week, { data: read }, { data: sleeps }] = await Promise.all([
    programP,
    getWeekState(supabase, today, programP),
    supabase.from("coach_reads").select("headline, lifting, weight, recovery").order("created_at", { ascending: false }).limit(1),
    supabase.from("sleep_logs").select("night_of, hours, wake_feeling").gte("night_of", addDays(today, -7)).order("night_of"),
  ]);
  const split = program.filter((d) => d.program === "split");
  const doneCount = split.filter((d) => week.done.has(d.id)).length;
  const lastNight = ((sleeps ?? []) as any[]).find((s) => s.night_of === addDays(today, -1));
  const nights = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7));
  const byNight = new Map(((sleeps ?? []) as any[]).map((s) => [s.night_of, Number(s.hours)]));
  const maxH = Math.max(9, ...[...byNight.values()]);
  const latest = read?.[0];
  const day = week.nextDay;
  const todayDone = day ? week.done.get(day.id) === today : false;

  return (
    <main className="screen">
      <BrandRow right={<Link href="/settings" className="iconbtn" aria-label="Settings"><IconGear /></Link>} />
      <div>
        <p className="cap" style={{ fontWeight: 600 }}>{fmtLong(today)}</p>
        <h1 className="disp" style={{ fontSize: 30, marginTop: 2 }}>Overview</h1>
      </div>

      <InstallCard />

      <div className="card cream" style={{ padding: 16 }}>
        <p className="lab" style={{ color: "var(--navy)", display: "flex", alignItems: "center", gap: 6 }}><CoachMark />Coach</p>
        <p style={{ fontSize: 15, lineHeight: 1.45, marginTop: 6 }}>
          {latest ? [latest.headline, latest.weight ?? latest.lifting].filter(Boolean).join(" ") : "Your first Coach read shows up after your first session or Monday weigh-in."}
        </p>
        <div style={{ textAlign: "right", marginTop: 8 }}><Link href="/coach" style={{ fontSize: 13, fontWeight: 600 }}>Ask Coach</Link></div>
      </div>

      <div className="card" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p className="lab">Sleep · last night</p>
            {lastNight ? (
              <p style={{ marginTop: 4 }}><span className="num" style={{ fontSize: 22 }}>{Number(lastNight.hours).toFixed(1)}</span> <span className="cap">hrs{lastNight.wake_feeling ? ` · ${FEEL[lastNight.wake_feeling]}` : ""}</span></p>
            ) : <p className="cap" style={{ marginTop: 4 }}>Not logged yet</p>}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 36, width: 112 }} aria-label="Last 7 nights">
            {nights.map((n) => {
              const h = byNight.get(n);
              return <div key={n} title={fmtDow(n)} style={{ flex: 1, borderRadius: 4, height: h ? `${Math.max(12, (h / maxH) * 100)}%` : "12%", background: h == null ? "var(--line-soft)" : n === addDays(today, -1) ? "var(--lagoon)" : "#D4EEF5" }} />;
            })}
          </div>
        </div>
        <div style={{ textAlign: "right", marginTop: 6 }}><Link href="/sleep" style={{ fontSize: 13, fontWeight: 600 }}>{lastNight ? "Edit sleep" : "Log sleep"}</Link></div>
      </div>

      {day ? (
        <Link href={week.inProgress ? `/train/session/${week.inProgress.id}` : "/train"} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", color: "var(--navy)" }}>
          <div>
            <p className="lab">Today&apos;s workout</p>
            <p className="disp" style={{ fontSize: 22, marginTop: 2 }}>{week.inProgress?.title ?? day.name}</p>
            <p className="cap">The Split · {doneCount} of {split.length} done this week</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`tag ${week.inProgress ? "ember" : todayDone ? "blue" : "ember"}`}>{week.inProgress ? "In progress" : todayDone ? "Done" : "Not started"}</span>
            <IconChevron />
          </div>
        </Link>
      ) : null}
    </main>
  );
}
