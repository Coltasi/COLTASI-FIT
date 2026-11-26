import Link from "next/link";
import { PageHeader, Section } from "@/components/ui";
import { IconPen, IconPlus } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtLong } from "@/lib/dates";
import { getEnergy, dayTotals, FOOD_DAYS_BACK, KCAL_PER_KG, type Energy, type DayTotal } from "@/lib/energy";
import { applySuggestedTarget } from "./actions";
import { DayNav } from "./day-nav";
import { EditFoods } from "./edit-foods";
import { macroLine } from "@/lib/portion";
import type { FoodRow } from "@/lib/rows";

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ day?: string; edit?: string }> }) {
  const { supabase, today, profile } = await getContext();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -FOOD_DAYS_BACK) ? sp.day : today;
  const [{ data: rows }, energy, { data: week }] = await Promise.all([
    supabase.from("food_logs").select("id, name, kcal, protein_g, carbs_g, fat_g, portion, source").eq("day", day).order("created_at"),
    getEnergy(supabase, today, profile.sex, profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week)),
    supabase.from("food_logs").select("day, kcal, protein_g").gte("day", sundayOf(today)).lte("day", today),
  ]);
  const items = (rows ?? []) as { id: string; name: string; kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; portion: string | null; source: string }[];
  const kcal = items.reduce((s, r) => s + Number(r.kcal), 0);
  const protein = items.reduce((s, r) => s + Number(r.protein_g), 0);
  const carbs = items.reduce((s, r) => s + Number(r.carbs_g ?? 0), 0);
  const fat = items.reduce((s, r) => s + Number(r.fat_g ?? 0), 0);
  // Entries from before carbs and fat were tracked (or estimates without them) don't count toward those totals.
  const missing = items.filter((r) => r.carbs_g == null || r.fat_g == null).length;
  const tK = profile.target_kcal ?? null, tP = profile.protein_g ?? null;
  const totals = new Map(dayTotals((week ?? []) as FoodRow[]).map((d) => [d.day, d]));

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

      <DeficitCard today={today} day={day} totals={totals} energy={energy} />
      </>
      )}
    </main>
  );
}

const legend = { display: "inline-flex", alignItems: "center", gap: 6 } as const;
const sw = { display: "inline-block", width: 14, height: 14, borderRadius: 4 } as const;

/** Sunday that starts the week containing `iso` (week strips are Sunday-first). */
function sundayOf(iso: string): string {
  return addDays(iso, -new Date(iso + "T12:00:00Z").getUTCDay());
}

/** A logged day under this is treated as unfinished: shown, but left out of the deficit (same bar as the TDEE math). */
const FULL_DAY_KCAL = 1000;
const C_EATEN = "#5cc0d8", C_DEFICIT = "#4fc59f", C_OVER = "#e0605a";

/** This week (Sun to Sat): what was eaten each day against the TDEE line, the gap shaded as deficit. */
function DeficitCard({ today, day, totals, energy }: { today: string; day: string; totals: Map<string, DayTotal>; energy: Energy }) {
  const tdee = energy.tdee;
  const start = sundayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const kcal = totals.get(d)?.kcal ?? 0;
    const full = d < today && kcal >= FULL_DAY_KCAL;
    return { d, kcal, full, future: d > today, isToday: d === today };
  });
  const counted = tdee ? days.filter((x) => x.full) : [];
  const total = tdee ? Math.round(counted.reduce((s, x) => s + (tdee - x.kcal), 0)) : 0;
  const has = counted.length > 0;
  const under = total >= 0;
  const kg = Math.abs(total) / KCAL_PER_KG;
  const H = 150;
  const top = Math.max((tdee ?? 2500) * 1.06, ...days.map((x) => x.kcal));
  const px = (k: number) => Math.round((k / top) * H);
  const rate = energy.rateKgWeek;

  return (
    <section className="feature" aria-label="Deficit this week" style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 700 }}>This week</p>
        {has ? (
          <span style={{ background: under ? "#e1f0ea" : "#f6e3e1", color: under ? "#1f6b57" : "#9b3030", fontSize: 15, fontWeight: 700, padding: "6px 12px", borderRadius: 999 }}>
            {under ? "In deficit" : "Over your burn"}
          </span>
        ) : null}
      </div>

      <div>
        <p className="num" style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {has ? Math.abs(total).toLocaleString("en-US") : "–"}<span style={{ fontSize: 22, fontWeight: 700 }}> kcal</span>
        </p>
        <p style={{ fontSize: 17, color: "var(--on-navy-muted)", marginTop: 8, lineHeight: 1.4 }}>
          {!tdee
            ? "Log a Tanita scan so your burn can be worked out."
            : !has
              ? "No full days logged yet this week. Today counts once it's over."
              : `${under ? "under" : "over"} your burn so far${kg >= 0.05 ? `, about ${kg.toFixed(1)} kg of fat` : ""}`}
        </p>
      </div>

      {tdee ? (
        <div>
          <div role="img" aria-label="Calories eaten each day this week against your daily burn"
            style={{ position: "relative", height: H + 24, display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 8, alignItems: "end" }}>
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: px(tdee), borderTop: "2px dashed rgba(255,255,255,.75)" }} />
            <div aria-hidden className="num" style={{ position: "absolute", right: 0, bottom: px(tdee) + 6, fontSize: 15, fontWeight: 700, background: "var(--navy)", paddingLeft: 6 }}>
              Burn {tdee.toLocaleString("en-US")}
            </div>
            {days.map((x) => {
              const eat = px(Math.min(x.kcal, tdee));
              const gap = x.full ? px(Math.max(0, tdee - x.kcal)) : 0;
              const over = x.full || x.isToday ? px(Math.max(0, x.kcal - tdee)) : 0;
              const partial = !x.full && x.kcal > 0;
              return (
                <Link prefetch={false} key={x.d} href={x.isToday ? "/food" : `/food?day=${x.d}`}
                  aria-label={`${x.d}: ${x.kcal ? `${Math.round(x.kcal)} kcal${x.full ? "" : ", not a full day"}` : "nothing logged"}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: H, pointerEvents: x.future ? "none" : undefined }}>
                  {over ? <span style={{ width: 28, height: over, background: C_OVER, borderRadius: "6px 6px 0 0" }} /> : null}
                  {gap ? <span style={{ width: 28, height: gap, background: C_DEFICIT, opacity: 0.85, borderRadius: "6px 6px 0 0" }} /> : null}
                  {eat ? (
                    <span style={{ width: 28, height: eat, boxSizing: "border-box", background: partial ? "transparent" : C_EATEN, border: partial ? `2px dashed ${C_EATEN}` : undefined, borderRadius: over || gap ? 0 : "6px 6px 0 0" }} />
                  ) : null}
                </Link>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 8, marginTop: 8 }}>
            {days.map((x) => (
              <p key={x.d} style={{ textAlign: "center", fontSize: 16, fontWeight: x.isToday || x.d === day ? 800 : 500, color: x.isToday || x.d === day ? "#fff" : "var(--on-navy-muted)" }}>
                {new Date(x.d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
              </p>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 14, fontSize: 15, color: "var(--on-navy-muted)" }}>
            <span style={legend}><i style={{ ...sw, background: C_EATEN }} />Eaten</span>
            <span style={legend}><i style={{ ...sw, background: C_DEFICIT }} />Deficit</span>
            <span style={legend}><i style={{ ...sw, background: C_OVER }} />Over</span>
            <span style={legend}><i style={{ ...sw, boxSizing: "border-box", border: `2px dashed ${C_EATEN}` }} />Not a full day</span>
          </div>
        </div>
      ) : null}

      <div style={{ borderTop: "1px solid var(--navy-2)", paddingTop: 16, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>Weight trend</p>
          <p className="num" style={{ fontSize: 22, fontWeight: 800, color: rate != null && rate < 0 ? C_DEFICIT : rate != null && rate > 0 ? C_OVER : undefined }}>
            {rate == null ? "–" : `${rate > 0 ? "+" : rate < 0 ? "−" : ""}${Math.abs(rate).toFixed(1)} kg/wk`}
          </p>
        </div>
        <p style={{ fontSize: 16, color: "var(--on-navy-muted)", lineHeight: 1.4 }}>
          {rate == null
            ? "A few more weigh-ins and the scale can confirm the deficit."
            : energy.source === "measured"
              ? "Your burn is worked out from what you eat and how your weight moves."
              : "Your burn is a formula estimate until 14 full days are logged."}
        </p>
      </div>
    </section>
  );
}

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
