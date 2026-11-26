import Link from "next/link";
import { PageHeader, Section } from "@/components/ui";
import { IconPen, IconPlus } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtLong } from "@/lib/dates";
import { getEnergy, dayTotals, FOOD_DAYS_BACK } from "@/lib/energy";
import { applySuggestedTarget } from "./actions";
import { DayNav } from "./day-nav";
import { EditFoods } from "./edit-foods";
import { macroLine } from "@/lib/portion";

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ day?: string; edit?: string }> }) {
  const { supabase, today, profile } = await getContext();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -FOOD_DAYS_BACK) ? sp.day : today;
  const [{ data: rows }, energy, { data: week }] = await Promise.all([
    supabase.from("food_logs").select("id, name, kcal, protein_g, carbs_g, fat_g, portion, source").eq("day", day).order("created_at"),
    getEnergy(supabase, today, profile.sex, profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week)),
    supabase.from("food_logs").select("day, kcal, protein_g").gte("day", addDays(today, -6)).lte("day", today),
  ]);
  const items = (rows ?? []) as { id: string; name: string; kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; portion: string | null; source: string }[];
  const kcal = items.reduce((s, r) => s + Number(r.kcal), 0);
  const protein = items.reduce((s, r) => s + Number(r.protein_g), 0);
  const carbs = items.reduce((s, r) => s + Number(r.carbs_g ?? 0), 0);
  const fat = items.reduce((s, r) => s + Number(r.fat_g ?? 0), 0);
  // Entries from before carbs and fat were tracked (or estimates without them) don't count toward those totals.
  const missing = items.filter((r) => r.carbs_g == null || r.fat_g == null).length;
  const tK = profile.target_kcal ?? null, tP = profile.protein_g ?? null;
  const totals = new Map(dayTotals((week ?? []) as any[]).map((d) => [d.day, d]));
  const maxK = Math.max(tK ?? 2500, ...[...totals.values()].map((d) => d.kcal));

  const yesterday = addDays(today, -1);
  const edit = sp.edit === "1";
  const min = addDays(today, -FOOD_DAYS_BACK);
  const dayQ = day === today ? "" : `day=${day}`;
  const viewHref = `/food${dayQ ? `?${dayQ}` : ""}`;
  const editHref = `/food?${dayQ ? `${dayQ}&` : ""}edit=1`;
  const showSuggest = energy.source === "measured" && energy.suggestedTarget != null && tK != null && Math.abs(energy.suggestedTarget - tK) >= 100;

  const kLeft = tK ? Math.round(tK - kcal) : null;
  const pLeft = tP ? Math.round(tP - protein) : null;
  const dayTitle = day === today ? `Today, ${fmtShortDay(day)}` : day === yesterday ? `Yesterday, ${fmtShortDay(day)}` : fmtLong(day);

  return (
    <main className="screen" style={{ gap: 22 }}>
      <PageHeader
        title="Nutrition"
        above={edit ? <span style={{ color: "var(--rust)", fontWeight: 700 }}>Editing</span> : undefined}
        right={edit ? undefined : <Link prefetch={false} href={editHref} className="btn2"><IconPen size={16} />Edit</Link>}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p className="ln">{dayTitle}</p>
        <DayNav day={day} today={today} min={min} edit={edit} />
      </div>

      {edit ? (
        <div style={{ background: "var(--tint-ember)", border: "1.5px solid var(--rust)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", color: "var(--rust)" }}>
          <IconPen size={18} />
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Change names, numbers or the day, or remove entries. Use the arrows to edit other days.</p>
        </div>
      ) : null}

      <section className="feature" aria-label="Daily nutrition">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Ring value={kcal} target={tK} left={kLeft} unit="kcal" label="Calories" color="var(--lagoon)" />
          <Ring value={protein} target={tP} left={pLeft} unit="g" label="Protein" color="#f0a67f" />
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <MacroBar label="Carbs" value={carbs} target={profile.carbs_g ?? null} color="#9fd0de" />
          <MacroBar label="Fat" value={fat} target={profile.fat_g ?? null} color="#f2c879" />
          {missing ? <p style={{ fontSize: 14, color: "var(--on-navy-muted)" }}>{missing} {missing === 1 ? "entry has" : "entries have"} no carbs or fat yet. Add them in Edit to count them.</p> : null}
        </div>
        <div style={{ borderTop: "1px solid var(--navy-2)", marginTop: 16, paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700 }}>Your TDEE</p>
            <p style={{ fontSize: 15, color: "var(--on-navy-muted)" }}>Calories you burn in a day</p>
          </div>
          <p className="num" style={{ fontSize: 26, fontWeight: 800 }}>{energy.tdee ? energy.tdee.toLocaleString("en-US") : "–"}<span style={{ fontSize: 15, color: "var(--on-navy-muted)", fontWeight: 600 }}> kcal</span></p>
        </div>
      </section>

      {edit ? null : (
        <Link prefetch={false} href={`/food/add${day === today ? "" : `?day=${day}`}`} className="btn">
          <IconPlus size={18} />Add food
        </Link>
      )}

      {edit ? (
        <EditFoods key={day} items={items} day={day} today={today} min={min} exitHref={viewHref} />
      ) : (
      <>
      <Section title="Food log" right={items.length ? <span className="cap">{items.length} {items.length === 1 ? "entry" : "entries"}</span> : undefined} gap={2}>
        {items.length ? (
          <div className="list">
            {items.map((r) => (
              <div key={r.id} className="li">
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <p className="t" style={{ fontSize: 16, lineHeight: 1.3 }}>{r.name}</p>
                  <p className="s">{r.portion ? `${r.portion} · ` : ""}{macroLine(r)}</p>
                </div>
                <p className="v">{Number(r.kcal).toLocaleString("en-US")} kcal</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: 18, marginTop: 8 }}>
            <p className="ln">Nothing logged {day === today ? "yet today" : "this day"}</p>
            <p className="cap" style={{ marginTop: 4 }}>Add what you eat as you go. Saved shakes and repeat meals are one tap.</p>
          </div>
        )}
      </Section>

      <Section title="How your TDEE is worked out" right={<span className={`tag ${energy.source === "measured" ? "jade" : "ember"}`}>{energy.source === "measured" ? "Personalised" : "Collecting data"}</span>}>
        <div className="card" style={{ padding: "16px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            <div>
              <p className="lab">TDEE (daily burn)</p>
              <p className="num" style={{ fontSize: 26 }}>{energy.tdee ? `${energy.tdee.toLocaleString("en-US")}` : "–"}<span className="cap"> kcal</span></p>
            </div>
            <div>
              <p className="lab">Your target</p>
              <p className="num" style={{ fontSize: 26 }}>{tK ? tK.toLocaleString("en-US") : "–"}<span className="cap"> kcal</span></p>
            </div>
          </div>
          {energy.source !== "measured" ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="ln" style={{ fontSize: 15 }}>Fully logged days</span>
                <span className="num" style={{ fontSize: 15 }}>{Math.min(energy.loggedDays, energy.daysNeeded)} of {energy.daysNeeded}</span>
              </div>
              <div className="meter" role="progressbar" aria-valuenow={energy.loggedDays} aria-valuemax={energy.daysNeeded} aria-label="Data collected">
                <i style={{ width: `${Math.min(100, (energy.loggedDays / energy.daysNeeded) * 100)}%`, background: "var(--kingfisher)" }} />
              </div>
            </div>
          ) : null}
          <p className="cap" style={{ lineHeight: 1.45 }}>
            {energy.source === "measured"
              ? `Estimated from ${energy.loggedDays} logged days averaging ${energy.avgKcal?.toLocaleString("en-US")} kcal, while your weight moved ${energy.rateKgWeek! > 0 ? "+" : ""}${energy.rateKgWeek!.toFixed(2)} kg a week. It's an estimate that keeps updating, not a measurement.`
              : `For now this is a formula estimate from your latest scan. Log full days of food and weigh in Mon, Wed and Fri: once ${energy.daysNeeded} days are in, it's recalculated from what you actually eat and how your weight moves.`}
          </p>
          {showSuggest ? (
            <form action={applySuggestedTarget} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <input type="hidden" name="kcal" value={energy.suggestedTarget!} />
              <input type="hidden" name="tdee" value={energy.tdee!} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>To hit your rate, eat {energy.suggestedTarget!.toLocaleString("en-US")} a day.</span>
              <button type="submit" className="btn2">Use it</button>
            </form>
          ) : null}
        </div>
      </Section>

      <Section title="Last 7 days" right={<span className="cap">kcal vs target</span>}>
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 8, alignItems: "end", height: 110, position: "relative" }}>
            {tK ? <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: `${(tK / maxK) * 100}%`, borderTop: "2px dashed var(--mist)" }} /> : null}
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(today, i - 6);
              const t = totals.get(d);
              const h = t ? Math.max(6, (t.kcal / maxK) * 100) : 100;
              const over = !!(t && tK && t.kcal > tK);
              return (
                <Link prefetch={false} key={d} href={d === today ? "/food" : `/food?day=${d}`}
                  aria-label={`${d}: ${t ? `${Math.round(t.kcal)} kcal${d === today ? ", day in progress" : ""}` : "nothing logged"}`}
                  style={t
                    ? { height: `${h}%`, borderRadius: 4, background: over ? "var(--ember)" : d === today ? "#9fd0de" : "var(--kingfisher)", position: "relative", zIndex: 1 }
                    : { height: "30%", borderRadius: 4, border: "1.5px dashed var(--mist)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mist)", fontSize: 15, fontWeight: 700 }}>
                  {t ? null : "–"}
                </Link>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 8, marginTop: 6 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(today, i - 6);
              return <p key={d} className="cap" style={{ textAlign: "center", fontWeight: d === today ? 800 : 500, color: d === day ? "var(--navy)" : undefined }}>{new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</p>;
            })}
          </div>
          <div className="cap" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12 }}>
            <span style={legend}><i style={{ ...sw, background: "var(--kingfisher)" }} />Logged</span>
            <span style={legend}><i style={{ ...sw, background: "#9fd0de" }} />Today so far</span>
            <span style={legend}><i style={{ ...sw, background: "var(--ember)" }} />Over target</span>
            <span style={legend}><i style={{ ...sw, border: "1.5px dashed var(--mist)" }} />Not logged</span>
            {tK ? <span style={legend}><i style={{ width: 16, borderTop: "2px dashed var(--mist)" }} />Target</span> : null}
          </div>
        </div>
      </Section>
      </>
      )}
    </main>
  );
}

const legend = { display: "inline-flex", alignItems: "center", gap: 6 } as const;
const sw = { display: "inline-block", width: 12, height: 12, borderRadius: 3 } as const;

const fmtShortDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Carbs or fat so far against the day's target, on the navy summary. */
function MacroBar({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const over = target != null && value > target;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 16 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span className="num" style={{ fontWeight: 600 }}>
          {Math.round(value)}{target ? <span style={{ color: "var(--on-navy-muted)" }}> / {target} g</span> : " g"}
          {target ? <span style={{ color: "var(--on-navy-muted)", fontSize: 14 }}> · {over ? `${Math.round(value - target)} over` : `${Math.round(target - value)} left`}</span> : null}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--navy-2)", marginTop: 6, overflow: "hidden" }}>
        <div style={{ width: `${target ? Math.min(100, (value / target) * 100) : 0}%`, height: "100%", borderRadius: 4, background: over ? "#f08a7a" : color }} />
      </div>
    </div>
  );
}

/** Remaining-first progress ring for the navy nutrition summary. */
function Ring({ value, target, left, unit, label, color }: { value: number; target: number | null; left: number | null; unit: string; label: string; color: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = target ? Math.min(1, value / target) : 0;
  const over = left != null && left < 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden>
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--navy-2)" strokeWidth="11" />
          <circle cx="64" cy="64" r={r} fill="none" stroke={over ? "#f08a7a" : color} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 64 64)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span className="num" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{left == null ? "–" : Math.abs(left).toLocaleString("en-US")}</span>
          <span style={{ fontSize: 14, color: "var(--on-navy-muted)", marginTop: 2 }}>{unit} {over ? "over" : "left"}</span>
        </div>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700 }}>{label}</p>
      <p className="num" style={{ fontSize: 16, color: "var(--on-navy-muted)", fontWeight: 600 }}>
        {Math.round(value).toLocaleString("en-US")}{target ? ` / ${target.toLocaleString("en-US")}` : ""}{unit === "g" ? " g" : ""}
      </p>
    </div>
  );
}
