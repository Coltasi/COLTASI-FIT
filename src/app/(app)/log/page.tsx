import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteMeal } from "./actions";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function todayRangeIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="bg-border mt-1 h-2 w-full overflow-hidden rounded-full">
      <div
        className="bg-blue h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export default async function LogHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { start, end } = todayRangeIso();

  const [{ data: targets }, { data: meals }] = await Promise.all([
    supabase
      .from("nutrition_targets")
      .select("target_kcal, target_protein_g, target_carbs_g, target_fat_g")
      .eq("user_id", user.id)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meals")
      .select("id, name, meal_type, calories, protein_g, carbs_g, fat_g, logged_at, photo_storage_path")
      .eq("user_id", user.id)
      .gte("logged_at", start)
      .lt("logged_at", end)
      .order("logged_at", { ascending: true }),
  ]);

  const mealsWithPhotos = (meals ?? []).filter((m) => m.photo_storage_path);
  const signedUrls = new Map<string, string>();
  if (mealsWithPhotos.length) {
    const results = await Promise.all(
      mealsWithPhotos.map((m) =>
        supabase.storage.from("meal-photos").createSignedUrl(m.photo_storage_path!, 3600),
      ),
    );
    mealsWithPhotos.forEach((m, i) => {
      const url = results[i].data?.signedUrl;
      if (url) signedUrls.set(m.id, url);
    });
  }

  const totals = (meals ?? []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.calories ?? 0),
      protein: acc.protein + (m.protein_g ?? 0),
      carbs: acc.carbs + (m.carbs_g ?? 0),
      fat: acc.fat + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-1 flex-col px-5 pt-[30px] pb-6">
      <p className="text-muted text-[15px]">{today}</p>
      <h1 className="font-display mt-1 mb-4 text-2xl font-extrabold tracking-tight">
        Log
      </h1>

      <div className="border-border bg-surface mb-4 rounded-[18px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]">
        <p className="mb-2.5 text-[15px] font-semibold">Today&apos;s food</p>
        {targets ? (
          <>
            <div className="mb-0.5 flex items-baseline justify-between">
              <span className="font-display text-[19px] font-extrabold">
                {Math.round(totals.kcal)}
              </span>
              <span className="text-muted text-xs">
                of {targets.target_kcal} kcal target
              </span>
            </div>
            <Bar pct={targets.target_kcal ? (totals.kcal / targets.target_kcal) * 100 : 0} />

            {targets.target_protein_g && (
              <div className="mt-3.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Protein</span>
                  <span className="text-muted">
                    {Math.round(totals.protein)} / {targets.target_protein_g}g
                  </span>
                </div>
                <Bar pct={(totals.protein / targets.target_protein_g) * 100} />
              </div>
            )}
            {targets.target_carbs_g && (
              <div className="mt-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Carbs</span>
                  <span className="text-muted">
                    {Math.round(totals.carbs)} / {targets.target_carbs_g}g
                  </span>
                </div>
                <Bar pct={(totals.carbs / targets.target_carbs_g) * 100} />
              </div>
            )}
            {targets.target_fat_g && (
              <div className="mt-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Fat</span>
                  <span className="text-muted">
                    {Math.round(totals.fat)} / {targets.target_fat_g}g
                  </span>
                </div>
                <Bar pct={(totals.fat / targets.target_fat_g) * 100} />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-muted text-[13px]">
              {Math.round(totals.kcal)} kcal logged today. No targets set yet —
              add them in Settings to see progress against a goal.
            </p>
          </>
        )}
      </div>

      <p className="text-muted mb-2 text-xs font-bold tracking-wide uppercase">
        Today&apos;s meals
      </p>
      <div className="flex flex-col gap-2.5">
        {(meals ?? []).length === 0 && (
          <p className="text-muted text-[14px]">Nothing logged yet today.</p>
        )}
        {(meals ?? []).map((m) => (
          <div
            key={m.id}
            className="border-border bg-surface flex items-center gap-3 rounded-[14px] border px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]"
          >
            {signedUrls.has(m.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrls.get(m.id)}
                alt=""
                className="border-border h-[46px] w-[46px] flex-shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <div className="border-border bg-border h-[46px] w-[46px] flex-shrink-0 rounded-lg border" />
            )}
            <div className="flex-1">
              <p className="text-[15px] font-semibold">{m.name}</p>
              <p className="text-muted text-xs">
                {[m.meal_type, formatTime(m.logged_at)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {m.calories != null && (
              <span className="font-display text-[15px] font-extrabold">
                {Math.round(m.calories)}
              </span>
            )}
            <form action={deleteMeal.bind(null, m.id)}>
              <button
                type="submit"
                aria-label="Remove meal"
                className="text-muted-2 px-1 text-lg leading-none"
              >
                ×
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="flex-1" />
      <Link
        href="/log/meal"
        className="bg-blue mt-5 flex items-center justify-center gap-2 rounded-xl py-4 text-[16px] font-semibold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Log Meal
      </Link>
    </div>
  );
}
