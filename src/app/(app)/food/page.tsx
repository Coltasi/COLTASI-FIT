import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { IconPen, IconPlus } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtLong } from "@/lib/dates";
import { getEnergy, dayTotals, FOOD_DAYS_BACK, KCAL_PER_KG, type Energy, type DayTotal } from "@/lib/energy";
import { w, unit, type Units } from "@/lib/units";
import { applySuggestedTarget } from "./actions";
import { DayNav } from "./day-nav";
import { EditFoods } from "./edit-foods";
import { macroLine } from "@/lib/portion";
import type { FoodRow } from "@/lib/rows";

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ day?: string; edit?: string; view?: string }> }) {
  const { supabase, today, profile, units } = await getContext();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -FOOD_DAYS_BACK) ? sp.day : today;
  const view = sp.view === "week" ? "week" : "day";
  const [{ data: rows }, energy, { data: week }, { data: lastWeigh }, { data: lastScan }] = await Promise.all([
    supabase.from("food_logs").select("id, name, kcal, protein_g, carbs_g, fat_g, portion, source").eq("day", day).order("created_at"),
    getEnergy(supabase, today, profile.sex, profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week)),
    supabase.from("food_logs").select("day, kcal, protein_g").gte("day", sundayOf(today)).lte("day", today),
    supabase.from("weigh_ins").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(1),
    supabase.from("scans").select("scanned_on, weight_kg").not("weight_kg", "is", null).order("scanned_on", { ascending: false }).limit(1),
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

  // Latest known body weight: newest of the last weigh-in and the last scan.
  const wi = lastWeigh?.[0] as { measured_on: string; weight_kg: number } | undefined;
  const sc = lastScan?.[0] as { scanned_on: string; weight_kg: number } | undefined;
  const currentKg = wi && (!sc || wi.measured_on >= sc.scanned_on) ? Number(wi.weight_kg) : sc ? Number(sc.weight_kg) : null;

  const yesterday = addDays(today, -1);
  const edit = sp.edit === "1";
  const min = addDays(today, -FOOD_DAYS_BACK);
  const q = (extra: Record<string, string>) => {
    const u = new URLSearchParams({ ...(day !== today ? { day } : {}), ...extra }).toString();
    return `/food${u ? `?${u}` : ""}`;
  };
  const viewHref = q(view === "week" ? { view: "week" } : {});
  const editHref = q({ edit: "1" });
  const showSuggest = energy.source === "measured" && energy.suggestedTarget != null && tK != null && Math.abs(energy.suggestedTarget - tK) >= 100;

  const kLeft = tK ? Math.round(tK - kcal) : null;
  const pLeft = tP ? Math.round(tP - protein) : null;
  const dayTitle = day === today ? `Today, ${fmtShortDay(day)}` : day === yesterday ? `Yesterday, ${fmtShortDay(day)}` : fmtLong(day);
  const loggedKcal = Math.round(kcal).toLocaleString("en-US");

  return (
    <main className="screen" style={{ gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PageHeader
          title="Nutrition"
          above={edit ? <span style={{ color: "var(--rust)", fontWeight: 700 }}>Editing</span> : undefined}
          right={edit ? undefined : <Link prefetch={false} href={editHref} className="btn2"><IconPen size={16} />Edit</Link>}
        />
        <p className="ln" style={{ fontSize: 17 }}>{dayTitle}</p>
        <DayNav day={day} today={today} min={min} edit={edit} />
      </div>

      {edit ? (
        <>
          <div style={{ background: "var(--tint-ember)", border: "1.5px solid var(--rust)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", color: "var(--rust)" }}>
            <IconPen size={18} />
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Change names, numbers or the day, or remove entries. Use the arrows to edit other days.</p>
          </div>
          <EditFoods key={day} items={items} day={day} today={today} min={min} exitHref={viewHref} />
        </>
      ) : (
      <>
      <Link prefetch={false} href={`/food/add${day === today ? "" : `?day=${day}`}`} className="btn"
        style={{ height: 60, borderRadius: 16, fontSize: 18, boxShadow: "0 6px 16px rgba(180,72,36,.28)" }}>
        <IconPlus size={22} />Add food
      </Link>

      <section className="feature" aria-label="Nutrition summary" style={{ padding: 20, gap: 20, borderRadius: 20 }}>
        <div role="tablist" aria-label="Summary view" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 4, background: "var(--navy-2)", borderRadius: 12, padding: 4 }}>
          {([["day", "Today"], ["week", "This week"]] as const).map(([v, label]) => (
            <Link key={v} prefetch={false} href={q(v === "week" ? { view: "week" } : {})} role="tab" aria-selected={view === v} replace scroll={false}
              style={{ minHeight: 44, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, textDecoration: "none",
                background: view === v ? "#fff" : "transparent", color: view === v ? "var(--navy)" : "var(--on-navy-muted)" }}>
              {v === "day" && day !== today ? "Day" : label}
            </Link>
          ))}
        </div>

        {view === "day" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Ring value={kcal} target={tK} left={kLeft} unit="kcal" label="Calories" color="var(--lagoon)" />
              <Ring value={protein} target={tP} left={pLeft} unit="g" label="Protein" color="#f0a67f" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
              <MacroBar label="Carbs" value={carbs} target={profile.carbs_g ?? null} color="#9fd0de" />
              <MacroBar label="Fat" value={fat} target={profile.fat_g ?? null} color="#f2c879" />
            </div>
            {missing ? <p style={{ fontSize: 15, color: "var(--on-navy-muted)", marginTop: -8 }}>{missing} {missing === 1 ? "entry has" : "entries have"} no carbs or fat yet. Add them in Edit to count them.</p> : null}
            <TdeeBlock energy={energy} sub={tK ? `kcal a day · target ${tK.toLocaleString("en-US")}` : "kcal a day"} />
          </>
        ) : (
          <WeekView today={today} day={day} totals={totals} energy={energy} proteinTarget={tP} currentKg={currentKg} goalKg={profile.goal_weight_kg == null ? null : Number(profile.goal_weight_kg)} units={units} />
        )}
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <details className="card" style={dropCard}>
          <summary style={dropSummary}>
            <span>
              <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>Food log</span>
              <span style={dropSub}>{items.length ? `${items.length} ${items.length === 1 ? "entry" : "entries"} · ${loggedKcal} kcal` : `Nothing logged ${day === today ? "yet today" : "this day"}`}</span>
            </span>
            <Chevron />
          </summary>
          {items.length ? (
            <div className="list" style={{ borderTop: "1px solid var(--line-soft)", padding: "0 20px" }}>
              {items.map((r) => (
                <div key={r.id} className="li">
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <p className="t" style={{ fontSize: 17, lineHeight: 1.3 }}>{r.name}</p>
                    <p className="s">{r.portion ? `${r.portion} · ` : ""}{macroLine(r)}</p>
                  </div>
                  <p className="v">{Number(r.kcal).toLocaleString("en-US")} kcal</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ padding: "0 20px 20px", fontSize: 17, color: "var(--muted)", lineHeight: 1.5 }}>Add what you eat as you go. Saved shakes and repeat meals are one tap.</p>
          )}
        </details>

        <details className="card" style={dropCard}>
          <summary style={dropSummary}>
            <span>
              <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>How your TDEE is worked out</span>
              <span style={dropSub}>{energy.source === "measured" ? "From your food log and weigh-ins" : `${Math.min(energy.loggedDays, energy.daysNeeded)} of ${energy.daysNeeded} full days logged`}</span>
            </span>
            <Chevron />
          </summary>
          <div style={{ padding: "0 20px 20px", display: "grid", gap: 14 }}>
            {energy.source !== "measured" ? (
              <div className="meter" role="progressbar" aria-valuenow={energy.loggedDays} aria-valuemax={energy.daysNeeded} aria-label="Full days logged">
                <i style={{ width: `${Math.min(100, (energy.loggedDays / energy.daysNeeded) * 100)}%`, background: "var(--kingfisher)" }} />
              </div>
            ) : null}
            <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.5 }}>
              {energy.source === "measured"
                ? `Worked out from ${energy.loggedDays} full days averaging ${energy.avgKcal?.toLocaleString("en-US")} kcal, while your weight moved ${energy.rateKgWeek! > 0 ? "+" : ""}${energy.rateKgWeek!.toFixed(2)} kg a week. It keeps updating as you log.`
                : `For now it's a formula estimate from your latest scan. Log full days and weigh in Mon, Wed and Fri: once ${energy.daysNeeded} full days are in, it's recalculated from what you actually eat and how your weight moves.`}
            </p>
            {showSuggest ? (
              <form action={applySuggestedTarget} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <input type="hidden" name="kcal" value={energy.suggestedTarget!} />
                <input type="hidden" name="tdee" value={energy.tdee!} />
                <span style={{ fontSize: 17, fontWeight: 600 }}>To hit your rate, eat {energy.suggestedTarget!.toLocaleString("en-US")} a day.</span>
                <button type="submit" className="btn2">Use it</button>
              </form>
            ) : null}
          </div>
        </details>
      </div>
      </>
      )}
    </main>
  );
}

const dropCard = { padding: 0, overflow: "hidden", borderRadius: 16 } as const;
const dropSummary = { listStyle: "none", cursor: "pointer", minHeight: 64, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "var(--navy)" } as const;
const dropSub = { display: "block", fontSize: 15, color: "var(--muted)", marginTop: 4 } as const;

function Chevron() {
  return (
    <svg className="chev" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const legend = { display: "inline-flex", alignItems: "center", gap: 6 } as const;
const sw = { display: "inline-block", width: 14, height: 14, borderRadius: 4 } as const;
const fmtShortDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Sunday that starts the week containing `iso` (week strips are Sunday-first). */
function sundayOf(iso: string): string {
  return addDays(iso, -new Date(iso + "T12:00:00Z").getUTCDay());
}

/** A logged day under this is treated as unfinished: shown, but left out of the weekly maths (same bar as the TDEE maths). */
const FULL_DAY_KCAL = 1000;
const C_EATEN = "#5cc0d8", C_DEFICIT = "#4fc59f", C_OVER = "#e0605a", C_PROTEIN = "#f0a67f";

/** The terracotta TDEE block, the same on both tabs. */
function TdeeBlock({ energy, sub }: { energy: Energy; sub: string }) {
  return (
    <div style={{ background: "var(--rust)", borderRadius: 16, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Your TDEE</span>
        {energy.source !== "measured" ? <span style={{ background: "rgba(255,255,255,.22)", fontSize: 15, fontWeight: 600, padding: "2px 10px", borderRadius: 999 }}>Estimate</span> : null}
      </span>
      <span style={{ textAlign: "right" }}>
        <span className="num" style={{ display: "block", fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>{energy.tdee ? energy.tdee.toLocaleString("en-US") : "–"}</span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginTop: 4 }}>{energy.tdee ? sub : "Log a scan to work it out"}</span>
      </span>
    </div>
  );
}

const fmtDM = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** This week (Sun to Sat): deficit vs TDEE, the chart, then weight, protein and goal rows. */
function WeekView({ today, day, totals, energy, proteinTarget, currentKg, goalKg, units }: {
  today: string; day: string; totals: Map<string, DayTotal>; energy: Energy; proteinTarget: number | null; currentKg: number | null; goalKg: number | null; units: Units;
}) {
  const tdee = energy.tdee;
  const start = sundayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const t = totals.get(d);
    const kcal = t?.kcal ?? 0;
    return { d, kcal, protein: t?.protein ?? 0, full: d < today && kcal >= FULL_DAY_KCAL, future: d > today, isToday: d === today };
  });
  const fullDays = days.filter((x) => x.full);
  const counted = tdee ? fullDays : [];
  const total = tdee ? Math.round(counted.reduce((s, x) => s + (tdee - x.kcal), 0)) : 0;
  const has = counted.length > 0;
  const under = total >= 0;
  const kg = Math.abs(total) / KCAL_PER_KG;
  const H = 140;
  const top = Math.max((tdee ?? 2500) * 1.06, ...days.map((x) => x.kcal));
  const px = (k: number) => Math.round((k / top) * H);
  const rate = energy.rateKgWeek;
  const hits = proteinTarget ? fullDays.map((x) => x.protein >= proteinTarget) : [];

  // Goal projection: only once the TDEE is measured (enough logs and weigh-ins), never a guessed date.
  let goalTitle = "Goal weight";
  let goalSub: string | null = null;
  let goalVal: string | null = null;
  let goalLink = false;
  if (goalKg == null) {
    goalSub = "Set one to see when you'll get there";
    goalLink = true;
  } else {
    goalTitle = `Goal ${w(goalKg, units)} ${unit(units)}`;
    const toGo = currentKg == null ? null : currentKg - goalKg;
    if (toGo != null && Math.abs(toGo) < 0.3) { goalSub = "You're there"; goalVal = "Reached"; }
    else if (energy.source !== "measured" || rate == null || currentKg == null) goalSub = "Projection starts once your TDEE is measured";
    else if (toGo! > 0 === rate < 0 && Math.abs(rate) >= 0.05) {
      const weeks = Math.abs(toGo!) / Math.abs(rate);
      goalSub = `${w(Math.abs(toGo!), units)} ${unit(units)} to go, at this pace`;
      goalVal = weeks > 104 ? "2+ years" : `by ${fmtDM(addDays(today, Math.round(weeks * 7)))}`;
    } else goalSub = "Not moving toward it yet";
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p className="num" style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {has ? Math.abs(total).toLocaleString("en-US") : "–"}<span style={{ fontSize: 20, fontWeight: 700 }}> kcal</span>
          </p>
          <p style={{ fontSize: 17, color: "var(--on-navy-muted)", marginTop: 8, lineHeight: 1.4 }}>
            {!tdee ? "Log a Tanita scan so your TDEE can be worked out."
              : !has ? "No full days yet this week. Today counts once it's over."
              : `${under ? "under" : "over"} your TDEE${kg >= 0.05 ? `, about ${kg.toFixed(1)} kg of fat` : ""}`}
          </p>
        </div>
        {has ? (
          <span style={{ background: under ? "#e1f0ea" : "#f6e3e1", color: under ? "#1f6b57" : "#9b3030", fontSize: 15, fontWeight: 700, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>
            {under ? "In deficit" : "Over TDEE"}
          </span>
        ) : null}
      </div>

      <TdeeBlock energy={energy} sub="kcal burned a day" />

      {tdee ? (
        <div>
          <div role="img" aria-label="Calories eaten each day this week against your TDEE"
            style={{ position: "relative", height: H, display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 8, alignItems: "end" }}>
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: px(tdee), borderTop: "3px dashed #f08a5d" }} />
            {days.map((x) => {
              const eat = px(Math.min(x.kcal, tdee));
              const gap = x.full ? px(Math.max(0, tdee - x.kcal)) : 0;
              const over = x.full || x.isToday ? px(Math.max(0, x.kcal - tdee)) : 0;
              const partial = !x.full && x.kcal > 0;
              const inner = (
                <>
                  {over ? <span style={{ width: 26, height: over, background: C_OVER, borderRadius: "6px 6px 0 0" }} /> : null}
                  {gap ? <span style={{ width: 26, height: gap, background: C_DEFICIT, opacity: 0.85, borderRadius: "6px 6px 0 0" }} /> : null}
                  {eat ? <span style={{ width: 26, height: eat, boxSizing: "border-box", background: partial ? "transparent" : C_EATEN, border: partial ? `2px dashed ${C_EATEN}` : undefined, borderRadius: over || gap ? 0 : "6px 6px 0 0" }} /> : null}
                </>
              );
              const col = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: H } as const;
              return x.future ? <div key={x.d} style={col} /> : (
                <Link prefetch={false} key={x.d} href={x.isToday ? "/food?view=week" : `/food?day=${x.d}&view=week`}
                  aria-label={`${x.d}: ${x.kcal ? `${Math.round(x.kcal)} kcal${x.full ? "" : ", not a full day"}` : "nothing logged"}`} style={col}>
                  {inner}
                </Link>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 8, marginTop: 8 }}>
            {days.map((x) => (
              <p key={x.d} style={{ textAlign: "center", fontSize: 15, fontWeight: x.isToday || x.d === day ? 800 : 500, color: x.isToday || x.d === day ? "#fff" : "var(--on-navy-muted)" }}>
                {new Date(x.d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
              </p>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 16, fontSize: 15, color: "var(--on-navy-muted)" }}>
            <span style={legend}><i style={{ ...sw, background: C_EATEN }} />Eaten</span>
            <span style={legend}><i style={{ ...sw, background: C_DEFICIT }} />Deficit</span>
            <span style={legend}><i style={{ ...sw, background: C_OVER }} />Over</span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", marginBottom: -14 }}>
        <Row title="Weight trend" value={rate == null ? "–" : `${rate > 0 ? "+" : rate < 0 ? "−" : ""}${w(Math.abs(rate), units)} ${unit(units)}/wk`}
          sub={rate == null ? "A few more weigh-ins and the trend shows" : null}
          color={rate != null && rate < 0 ? C_DEFICIT : rate != null && rate > 0 ? C_OVER : "#fff"} />
        {proteinTarget ? (
          <div style={rowStyle}>
            <span>
              <span style={{ display: "block", fontSize: 17, fontWeight: 600 }}>Protein</span>
              <span style={rowSub}>Days you hit {proteinTarget} g</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <span className="num" style={{ fontSize: 22, fontWeight: 800, color: C_PROTEIN, whiteSpace: "nowrap" }}>{hits.length ? `${hits.filter(Boolean).length} of ${hits.length}` : "–"}</span>
              {hits.length ? (
                <span style={{ display: "flex", gap: 6 }} aria-hidden>
                  {hits.map((h, i) => <i key={i} style={{ width: 12, height: 12, borderRadius: 999, boxSizing: "border-box", display: "inline-block", background: h ? C_PROTEIN : "transparent", border: h ? undefined : `2px solid ${C_PROTEIN}` }} />)}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
        {goalLink ? (
          <Link prefetch={false} href="/settings/profile" style={{ ...rowStyle, textDecoration: "none", color: "#fff" }}>
            <span>
              <span style={{ display: "block", fontSize: 17, fontWeight: 600 }}>{goalTitle}</span>
              <span style={rowSub}>{goalSub}</span>
            </span>
            <span className="btn2" style={{ background: "var(--navy-2)", color: "#fff", borderColor: "transparent", fontSize: 17 }}>Set goal</span>
          </Link>
        ) : (
          <Row title={goalTitle} sub={goalSub} value={goalVal} color="#fff" />
        )}
      </div>
    </>
  );
}

const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 0", borderTop: "1px solid var(--navy-2)" } as const;
const rowSub = { display: "block", fontSize: 15, color: "var(--on-navy-muted)", marginTop: 4, lineHeight: 1.35 } as const;

function Row({ title, sub, value, color }: { title: string; sub: string | null; value: string | null; color: string }) {
  return (
    <div style={rowStyle}>
      <span>
        <span style={{ display: "block", fontSize: 17, fontWeight: 600 }}>{title}</span>
        {sub ? <span style={rowSub}>{sub}</span> : null}
      </span>
      {value ? <span className="num" style={{ fontSize: 22, fontWeight: 800, color, whiteSpace: "nowrap" }}>{value}</span> : null}
    </div>
  );
}

/** Carbs or fat so far against the day's target, on the navy summary. */
function MacroBar({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const over = target != null && value > target;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{label}</span>
        <span className="num" style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", color: over ? "#f08a7a" : "var(--on-navy-muted)" }}>
          {Math.round(value)}{target ? ` / ${target}` : ""} g
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--navy-2)", marginTop: 8, overflow: "hidden" }}>
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
          <span style={{ fontSize: 15, color: "var(--on-navy-muted)", marginTop: 2 }}>{unit} {over ? "over" : "left"}</span>
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 700 }}>{label}</p>
      <p className="num" style={{ fontSize: 15, color: "var(--on-navy-muted)", fontWeight: 600 }}>
        {Math.round(value).toLocaleString("en-US")}{target ? ` / ${target.toLocaleString("en-US")}` : ""}{unit === "g" ? " g" : ""}
      </p>
    </div>
  );
}
