import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProgressTabs } from "./progress-tabs";

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function buildSparkline(points: { weight: number }[], width: number, height: number, pad: number) {
  if (points.length < 2) return "";
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (width - pad * 2) + pad;
      const y = pad + (height - pad * 2) - ((p.weight - min) / span) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: scans }, { data: sleepLogs }, { data: days }, { data: programExercises }] =
    await Promise.all([
      supabase
        .from("body_comp_scans")
        .select("id, scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, water_pct")
        .eq("user_id", user.id)
        .order("scanned_at", { ascending: true }),
      supabase
        .from("sleep_logs")
        .select("log_date, hours")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false })
        .limit(14),
      supabase.from("program_days").select("id, name, day_order").order("day_order"),
      supabase
        .from("program_exercises")
        .select("program_day_id, order_index, exercises(id, name)")
        .order("order_index"),
    ]);

  const recentScans = (scans ?? []).slice(-6);
  const latestScan = scans && scans.length > 0 ? scans[scans.length - 1] : null;
  const weightPoints = recentScans
    .filter((s) => s.weight_kg != null)
    .map((s) => ({ weight: s.weight_kg as number, date: s.scanned_at }));

  const scanIds = (scans ?? []).map((s) => s.id);
  const { data: scanPhotos } = scanIds.length
    ? await supabase
        .from("body_comp_scan_photos")
        .select("scan_id, storage_path, created_at")
        .in("scan_id", scanIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const firstPhotoByScan = new Map<string, string>();
  for (const p of scanPhotos ?? []) {
    if (!firstPhotoByScan.has(p.scan_id)) firstPhotoByScan.set(p.scan_id, p.storage_path);
  }
  const recentScanIds = (scans ?? []).slice(-5).map((s) => s.id);
  const signedUrls = new Map<string, string>();
  const withPhotos = recentScanIds.filter((id) => firstPhotoByScan.has(id));
  if (withPhotos.length) {
    const results = await Promise.all(
      withPhotos.map((id) =>
        supabase.storage.from("scan-photos").createSignedUrl(firstPhotoByScan.get(id)!, 3600),
      ),
    );
    withPhotos.forEach((id, i) => {
      const url = results[i].data?.signedUrl;
      if (url) signedUrls.set(id, url);
    });
  }

  const sleepChrono = [...(sleepLogs ?? [])].reverse();
  const avgHours =
    sleepChrono.length > 0
      ? sleepChrono.reduce((sum, s) => sum + (s.hours ?? 0), 0) / sleepChrono.length
      : null;
  const maxHours = Math.max(1, ...sleepChrono.map((s) => s.hours ?? 0));

  const exerciseIds = (programExercises ?? [])
    .map((pe) => (pe.exercises as unknown as { id: string; name: string } | null)?.id)
    .filter((id): id is string => !!id);

  const { data: allSets } = exerciseIds.length
    ? await supabase
        .from("workout_sets")
        .select("exercise_id, weight_kg, workout_sessions(session_date)")
        .in("exercise_id", exerciseIds)
        .eq("completed", true)
        .not("weight_kg", "is", null)
        .order("created_at", { ascending: true })
    : { data: [] };

  const historyByExercise = new Map<string, Map<string, number>>();
  for (const s of allSets ?? []) {
    const sess = s.workout_sessions as unknown as { session_date: string } | null;
    if (!sess) continue;
    let m = historyByExercise.get(s.exercise_id);
    if (!m) {
      m = new Map();
      historyByExercise.set(s.exercise_id, m);
    }
    m.set(sess.session_date, Math.max(m.get(sess.session_date) ?? 0, s.weight_kg!));
  }

  const byDay = new Map<string, { id: string; name: string }[]>();
  for (const pe of programExercises ?? []) {
    const ex = pe.exercises as unknown as { id: string; name: string } | null;
    if (!ex) continue;
    const arr = byDay.get(pe.program_day_id) ?? [];
    if (!arr.some((e) => e.id === ex.id)) arr.push(ex);
    byDay.set(pe.program_day_id, arr);
  }

  const bodyContent = (
    <>
      <div className="border-border bg-surface mb-4 rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <p className="mb-2.5 text-[15px] font-semibold">
          Weight trend {recentScans.length > 0 ? `· ${recentScans.length} scans` : ""}
        </p>
        {weightPoints.length > 1 ? (
          <>
            <svg viewBox="0 0 320 110" width="100%" height="110" style={{ overflow: "visible" }}>
              <polyline
                points={buildSparkline(weightPoints, 320, 100, 0)}
                fill="none"
                stroke="#2B7FAE"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="0" y1="100" x2="320" y2="100" stroke="#E4E1D9" strokeWidth="1" />
            </svg>
            <div className="text-muted flex justify-between text-xs">
              {weightPoints.map((p) => (
                <span key={p.date}>{formatShortDate(p.date)}</span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted text-[13px]">
            Log at least two scans to see a trend line.
          </p>
        )}
      </div>

      <div className="border-border bg-surface mb-4 flex justify-between rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        {latestScan ? (
          <>
            <div>
              <div className="font-display text-[19px] font-extrabold">
                {latestScan.body_fat_pct != null ? `${latestScan.body_fat_pct}%` : "—"}
              </div>
              <div className="text-muted text-xs">body fat</div>
            </div>
            <div>
              <div className="font-display text-[19px] font-extrabold">
                {latestScan.muscle_mass_kg != null ? `${latestScan.muscle_mass_kg} kg` : "—"}
              </div>
              <div className="text-muted text-xs">muscle</div>
            </div>
            <div>
              <div className="font-display text-[19px] font-extrabold">
                {latestScan.water_pct != null ? `${latestScan.water_pct}%` : "—"}
              </div>
              <div className="text-muted text-xs">water</div>
            </div>
          </>
        ) : (
          <p className="text-muted text-[13px]">No scans logged yet.</p>
        )}
      </div>

      <div className="border-border bg-surface mb-4 rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <p className="mb-2.5 text-[15px] font-semibold">
          Sleep {avgHours != null ? `· avg ${avgHours.toFixed(1)} hrs/night` : ""}
        </p>
        {sleepChrono.length > 0 ? (
          <>
            <div className="flex h-9 items-end gap-1.5">
              {sleepChrono.map((s, i) => (
                <div
                  key={s.log_date}
                  className="w-full rounded"
                  style={{
                    height: `${Math.max(10, ((s.hours ?? 0) / maxHours) * 100)}%`,
                    background: i === sleepChrono.length - 1 ? "#1FA6C9" : "#D9EEF4",
                  }}
                />
              ))}
            </div>
            <p className="text-muted mt-1 text-xs">last {sleepChrono.length} nights</p>
          </>
        ) : (
          <p className="text-muted text-[13px]">No sleep logged yet.</p>
        )}
      </div>

      <div className="border-border bg-surface rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <p className="mb-2.5 text-[15px] font-semibold">Scan history</p>
        <div className="flex gap-2.5 overflow-x-auto">
          {(scans ?? [])
            .slice(-5)
            .map((s) => (
              <div key={s.id} className="flex-shrink-0">
                {signedUrls.has(s.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedUrls.get(s.id)}
                    alt=""
                    className="border-border h-24 w-[76px] rounded-lg border object-cover"
                  />
                ) : (
                  <div className="border-border bg-border h-24 w-[76px] rounded-lg border" />
                )}
                <p className="text-muted mt-1 text-center text-[11px]">
                  {formatShortDate(s.scanned_at)}
                </p>
              </div>
            ))}
          <Link href="/progress/scan" className="flex-shrink-0">
            <div className="border-muted-2 bg-border flex h-24 w-[76px] items-center justify-center rounded-lg border border-dashed text-2xl text-[#B8B4AB]">
              +
            </div>
            <p className="text-muted mt-1 text-center text-[11px]">Add scan</p>
          </Link>
        </div>
      </div>
    </>
  );

  const liftingContent = (
    <div className="flex flex-col gap-1">
      {(days ?? []).map((day) => {
        const exercises = byDay.get(day.id) ?? [];
        if (exercises.length === 0) return null;
        return (
          <div key={day.id}>
            <p className="text-muted mt-3.5 mb-2 text-xs font-bold tracking-wide uppercase">
              {day.name}
            </p>
            <div className="flex flex-col gap-2.5">
              {exercises.map((ex) => {
                const history = historyByExercise.get(ex.id);
                const points = history
                  ? [...history.entries()]
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .slice(-4)
                      .map(([date, weight]) => ({ date, weight }))
                  : [];
                const best = points.length
                  ? points.reduce((a, b) => (b.weight > a.weight ? b : a))
                  : null;

                return (
                  <Link
                    key={ex.id}
                    href={`/train/exercise/${ex.id}`}
                    className="border-border bg-surface flex items-center justify-between gap-2.5 rounded-[14px] border px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
                  >
                    <div>
                      <p className="text-[15px] font-semibold">{ex.name}</p>
                      <p className="text-muted text-xs">
                        {best ? `Best ${best.weight} kg · ${formatShortDate(best.date)}` : "Not logged yet"}
                      </p>
                    </div>
                    {points.length > 1 && (
                      <svg viewBox="0 0 80 30" width="70" height="30" className="flex-shrink-0">
                        <polyline
                          points={buildSparkline(points, 80, 30, 3)}
                          fill="none"
                          stroke="#2B7FAE"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="px-5 pt-[30px] pb-8">
      <p className="text-muted text-[15px]">Body Composition</p>
      <h1 className="font-display mt-1 mb-4.5 text-2xl font-extrabold tracking-tight">
        Progress
      </h1>

      <ProgressTabs body={bodyContent} lifting={liftingContent} />
    </div>
  );
}
