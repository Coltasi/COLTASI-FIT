import Link from "next/link";
import { BrandRow } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { getContext } from "@/lib/data";
import { addDays, fmtLong } from "@/lib/dates";
import { getEnergy, dayTotals } from "@/lib/energy";
import { deleteFood, applySuggestedTarget } from "./actions";
import { IntakeBars, leftLine } from "./bars";

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { supabase, today, profile } = await getContext();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -14) ? sp.day : today;
  const [{ data: rows }, energy, { data: week }] = await Promise.all([
    supabase.from("food_logs").select("id, name, kcal, protein_g, source").eq("day", day).order("created_at"),
    getEnergy(supabase, today, profile.sex, profile.target_rate_kg_week == null ? null : Number(profile.target_rate_kg_week)),
    supabase.from("food_logs").select("day, kcal, protein_g").gte("day", addDays(today, -6)).lte("day", today),
  ]);
  const items = (rows ?? []) as { id: string; name: string; kcal: number; protein_g: number; source: string }[];
  const kcal = items.reduce((s, r) => s + Number(r.kcal), 0);
  const protein = items.reduce((s, r) => s + Number(r.protein_g), 0);
  const tK = profile.target_kcal ?? null, tP = profile.protein_g ?? null;
  const totals = new Map(dayTotals((week ?? []) as any[]).map((d) => [d.day, d]));
  const maxK = Math.max(tK ?? 2500, ...[...totals.values()].map((d) => d.kcal));

  const yesterday = addDays(today, -1);
  const showSuggest = energy.source === "measured" && energy.suggestedTarget != null && tK != null && Math.abs(energy.suggestedTarget - tK) >= 100;

  return (
    <main className="screen">
      <BrandRow />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
        <h1 className="disp" style={{ fontSize: 30, lineHeight: 1.1 }}>{day === today ? "Today" : day === yesterday ? "Yesterday" : fmtLong(day)}</h1>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/food" className={`chip${day === today ? " on" : ""}`}>Today</Link>
          <Link href={`/food?day=${yesterday}`} className={`chip${day === yesterday ? " on" : ""}`}>Yesterday</Link>
        </div>
      </div>

      <div className="card" style={{ padding: "14px 16px", display: "grid", gap: 10 }}>
        <IntakeBars kcal={kcal} protein={protein} targetKcal={tK} targetProtein={tP} />
        <p className="cap" style={{ fontSize: 13 }}>{leftLine(kcal, protein, tK, tP)}</p>
      </div>

      <div className="card clip">
        {items.length ? items.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 16px", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
              <p className="cap" style={{ fontSize: 12 }}>{Number(r.kcal).toLocaleString("en-US")} kcal · {Math.round(Number(r.protein_g))} g protein</p>
            </div>
            <form action={deleteFood}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" aria-label={`Remove ${r.name}`} style={{ background: "none", border: 0, color: "var(--stone)", fontSize: 20, lineHeight: 1, padding: 8, cursor: "pointer" }}>×</button>
            </form>
          </div>
        )) : (
          <p style={{ padding: "16px", fontSize: 14 }} className="cap">Nothing logged {day === today ? "yet today" : "this day"}. Add what you eat as you go: shakes are one tap once saved.</p>
        )}
      </div>

      <Link href={`/food/add${day === today ? "" : `?day=${day}`}`} className="btn" style={{ height: 50, gap: 8, boxShadow: "none" }}>
        <IconPlus size={18} />Add food
      </Link>

      <div className="card" style={{ padding: "14px 16px", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p className="lab">Energy</p>
          <span className={`tag ${energy.source === "measured" ? "blue" : "ember"}`}>{energy.source === "measured" ? "Measured" : "Estimate"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
          <div><p className="cap" style={{ fontSize: 12 }}>TDEE</p><p className="num" style={{ fontSize: 22 }}>{energy.tdee ? energy.tdee.toLocaleString("en-US") : "–"}</p></div>
          <div><p className="cap" style={{ fontSize: 12 }}>Your target</p><p className="num" style={{ fontSize: 22 }}>{tK ? tK.toLocaleString("en-US") : "–"}</p></div>
        </div>
        <p className="cap" style={{ fontSize: 13, lineHeight: 1.4 }}>
          {energy.source === "measured"
            ? `From ${energy.loggedDays} logged days averaging ${energy.avgKcal?.toLocaleString("en-US")} kcal, while your weight moved ${energy.rateKgWeek! > 0 ? "+" : ""}${energy.rateKgWeek!.toFixed(2)} kg a week.`
            : `A formula guess from your latest scan. Log full days of food and weigh in Mon, Wed and Fri: after ${energy.daysNeeded} logged days (${energy.loggedDays} so far) this switches to your real number.`}
        </p>
        {showSuggest ? (
          <form action={applySuggestedTarget} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
            <input type="hidden" name="kcal" value={energy.suggestedTarget!} />
            <input type="hidden" name="tdee" value={energy.tdee!} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>To hit your rate, eat {energy.suggestedTarget!.toLocaleString("en-US")} a day.</span>
            <button type="submit" className="btn2">Use it</button>
          </form>
        ) : null}
      </div>

      <div className="card" style={{ padding: "12px 14px" }}>
        <p className="lab">Last 7 days</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6, alignItems: "end", height: 70, marginTop: 8, position: "relative" }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(today, i - 6);
            const t = totals.get(d);
            const h = t ? Math.max(6, (t.kcal / maxK) * 100) : 6;
            return (
              <Link key={d} href={d === today ? "/food" : `/food?day=${d}`} aria-label={`${d}: ${t ? Math.round(t.kcal) : 0} kcal`}
                style={{ height: `${h}%`, borderRadius: 3, background: !t ? "var(--line-soft)" : tK && t.kcal > tK ? "var(--ember)" : d === day ? "var(--kingfisher)" : "#BFE0EC" }} />
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6, marginTop: 4 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(today, i - 6);
            return <p key={d} className="cap" style={{ fontSize: 11, textAlign: "center", fontWeight: d === today ? 700 : 400 }}>{new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</p>;
          })}
        </div>
      </div>
    </main>
  );
}
