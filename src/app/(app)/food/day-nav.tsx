"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Previous/next day arrows plus a date picker to jump to any day you can still edit. */
export function DayNav({ day, today, min, edit }: { day: string; today: string; min: string; edit: boolean }) {
  const router = useRouter();
  const href = (d: string) => `/food?${new URLSearchParams({ ...(d !== today ? { day: d } : {}), ...(edit ? { edit: "1" } : {}) })}`.replace(/\?$/, "");
  const shift = (n: number) => { const t = new Date(day + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const prev = shift(-1), next = shift(1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {prev >= min ? <Link href={href(prev)} className="btn2" aria-label="Previous day" style={arrow}>‹</Link> : <span className="btn2" style={{ ...arrow, opacity: 0.35 }} aria-hidden>‹</span>}
      <input type="date" className="fld" value={day} min={min} max={today} aria-label="Pick a day"
        onChange={(e) => { const v = e.target.value; if (v && v >= min && v <= today) router.push(href(v)); }}
        style={{ flexGrow: 1, height: 44, textAlign: "center", fontWeight: 600 }} />
      {next <= today ? <Link href={href(next)} className="btn2" aria-label="Next day" style={arrow}>›</Link> : <span className="btn2" style={{ ...arrow, opacity: 0.35 }} aria-hidden>›</span>}
      {day !== today ? <Link href={href(today)} className="chip">Today</Link> : null}
    </div>
  );
}

const arrow = { width: 44, height: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, lineHeight: 1 } as const;
