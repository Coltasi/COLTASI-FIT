"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, fmtShort } from "@/lib/dates";

export type CalSession = { id: string; date: string; kind: string; title: string };

const KIND: Record<string, { label: string; color: string }> = {
  split: { label: "Split", color: "var(--kingfisher)" },
  kettlebell: { label: "Kettlebell", color: "var(--navy)" },
  custom: { label: "Custom", color: "var(--ember)" },
};
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const monthName = (y: number, m: number) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 15)));
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);

/** Month grid of finished workouts, coloured by kind. Tap a day to open that workout. */
export function WorkoutCalendar({ sessions, today, bare = false }: { sessions: CalSession[]; today: string; bare?: boolean }) {
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  const [ym, setYm] = useState({ y: ty, m: tm });
  const [picked, setPicked] = useState<string | null>(null);
  const byDate = new Map<string, CalSession[]>();
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const first = iso(ym.y, ym.m, 1);
  const lead = new Date(first + "T12:00:00Z").getUTCDay(); // Sun = 0
  const daysIn = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => iso(ym.y, ym.m, i + 1))];
  while (cells.length % 7) cells.push(null);

  const inMonth = sessions.filter((s) => s.date.startsWith(first.slice(0, 7)));
  const trainedDays = new Set(inMonth.map((s) => s.date)).size;
  // Current streak of weeks with at least one workout, ending this week.
  const weeks = new Set(sessions.map((s) => { const d = new Date(s.date + "T12:00:00Z"); return addDays(s.date, -d.getUTCDay()); }));
  let streak = 0;
  for (let wk = addDays(today, -new Date(today + "T12:00:00Z").getUTCDay()); weeks.has(wk); wk = addDays(wk, -7)) streak++;

  const earliest = sessions.map((s) => s.date).sort()[0] ?? today;
  const canBack = first > earliest.slice(0, 7) + "-01";
  const canFwd = ym.y < ty || (ym.y === ty && ym.m < tm);
  const move = (n: number) => { setPicked(null); setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }); };
  const pickedSessions = picked ? byDate.get(picked) ?? [] : [];

  const navBtn = (on: boolean) => ({ width: 44, height: 44, borderRadius: 12, border: "1px solid var(--line-strong)", background: "#fff", color: on ? "var(--navy)" : "var(--mist)", cursor: on ? "pointer" : "default", fontSize: 16, fontWeight: 700, fontFamily: "inherit", padding: 0 } as const);

  return (
    <div className={bare ? undefined : "card"} style={{ padding: bare ? 0 : "18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="ln">{monthName(ym.y, ym.m)}</p>
          <p className="cap">
            {trainedDays} {trainedDays === 1 ? "day" : "days"} trained{streak > 1 && ym.y === ty && ym.m === tm ? ` · ${streak}-week streak` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" aria-label="Previous month" disabled={!canBack} onClick={() => move(-1)} style={navBtn(canBack)}>‹</button>
          <button type="button" aria-label="Next month" disabled={!canFwd} onClick={() => move(1)} style={navBtn(canFwd)}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 4, marginTop: 10 }}>
        {DOW.map((d, i) => <p key={i} className="cap" style={{ textAlign: "center" }}>{d}</p>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const ss = byDate.get(d) ?? [];
          const isToday = d === today;
          const future = d > today;
          const fill = ss.length ? KIND[ss[0].kind]?.color ?? "var(--kingfisher)" : null;
          const sel = picked === d;
          return (
            <button key={d} type="button" disabled={!ss.length} onClick={() => setPicked(sel ? null : d)}
              aria-label={`${fmtShort(d)}${ss.length ? `: ${ss.map((s) => s.title).join(", ")}` : ""}`}
              style={{
                aspectRatio: "1", borderRadius: 8, padding: 0, fontFamily: "inherit", fontSize: 15, fontWeight: isToday ? 800 : 600,
                border: sel ? "2px solid var(--navy)" : isToday ? "2px solid var(--rust)" : "1px solid transparent",
                background: fill ?? (future ? "transparent" : "var(--line-soft)"),
                color: fill ? "#fff" : future ? "var(--mist)" : "var(--muted)", cursor: ss.length ? "pointer" : "default", position: "relative",
              }}>
              {Number(d.slice(8))}
              {ss.length > 1 ? <span aria-hidden style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: KIND[ss[1].kind]?.color ?? "#fff", border: "1px solid #fff" }} /> : null}
            </button>
          );
        })}
      </div>

      {pickedSessions.length ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {pickedSessions.map((s) => (
            <Link key={s.id} href={`/train/session/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "var(--navy)", minHeight: 44 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: KIND[s.kind]?.color ?? "var(--kingfisher)" }} />
              {fmtShort(s.date)} · {s.title}<span style={{ color: "var(--ember-text)", marginLeft: "auto" }}>View ›</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="cap" style={{ display: "flex", gap: 14, marginTop: 12 }}>
        {Object.values(KIND).map((k) => (
          <span key={k.label} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: k.color }} />{k.label}</span>
        ))}
      </div>
    </div>
  );
}
