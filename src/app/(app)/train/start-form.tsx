"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startSession } from "./actions";
import { unit, w, type Units } from "@/lib/units";
import type { Finisher } from "@/lib/data";

const WARMUPS = [
  { v: "stairs", l: "Stairs" },
  { v: "elliptical", l: "Elliptical" },
  { v: "treadmill", l: "Treadmill" },
  { v: "rower", l: "Rower" },
];

function StartButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={disabled || pending}>
      {pending ? "Starting…" : label}
    </button>
  );
}

export function StartForm({ dayId, dayName, units, lifts, finishers, disabled }: {
  dayId: string; dayName: string; units: Units; disabled: boolean; finishers: Finisher[];
  lifts: { key: string; position: number; name: string; plan: string; lastKg: number | null; hasLast: boolean; coach: { tone: "up" | "down"; text: string } | null }[];
}) {
  const [warmup, setWarmup] = useState("stairs");
  const [finisherOn, setFinisherOn] = useState(true);
  const [cooldown, setCooldown] = useState(true);
  const fin = (finishers.find((f) => f.is_default) ?? finishers[0]) as Finisher | undefined;

  return (
    <form action={startSession} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <input type="hidden" name="day_id" value={dayId} />
      <input type="hidden" name="warmup" value={warmup} />
      <input type="hidden" name="finisher" value={finisherOn && fin ? fin.name : ""} />
      <input type="hidden" name="finisher_moves" value={finisherOn && fin ? JSON.stringify(fin.moves) : ""} />
      {cooldown ? <input type="hidden" name="cooldown" value="on" /> : null}

      <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="sec">Workout plan</h2>
          <span className="cap">Last time</span>
        </div>
        <div className="list">
          {lifts.map((l) => (
            <div key={l.key} className="li">
              <div style={{ minWidth: 0, flexGrow: 1 }}>
                <p className="t">{l.name}</p>
                <p className="s">{l.plan}</p>
                {l.coach ? (
                  <p style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 15, fontWeight: 700, color: l.coach.tone === "up" ? "var(--jade)" : "var(--rust)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/coltasi-bird.svg" alt="" width={18} height={18} />
                    Coach: {l.coach.text}
                  </p>
                ) : null}
              </div>
              <div className="v">
                {l.lastKg != null ? `${w(l.lastKg, units)} ${unit(units)}` : <span className="cap" style={{ fontWeight: 500 }}>{l.hasLast ? "Bodyweight" : "New"}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <details className="card" style={{ padding: "0 16px" }}>
        <summary style={{ listStyle: "none", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
          <span>
            <span className="ln" style={{ display: "block" }}>Workout preparation</span>
            <span className="cap">{[WARMUPS.find((o) => o.v === warmup)?.l ?? "No warm-up", finisherOn && fin ? "Ab finisher" : null, cooldown ? "Cool-down" : null].filter(Boolean).join(" · ")}</span>
          </span>
          <span style={{ color: "var(--ember-text)", fontSize: 15, fontWeight: 700 }}>Edit</span>
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          <p className="ln">Warm-up · 10 min</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {WARMUPS.map((o) => {
              const on = warmup === o.v;
              return (
                <button key={o.v} type="button" aria-pressed={on} onClick={() => setWarmup(on ? "" : o.v)}
                  style={{
                    height: 48, borderRadius: 12, fontSize: 16, fontWeight: on ? 700 : 600, cursor: "pointer",
                    border: on ? "2px solid var(--rust)" : "1px solid var(--line-strong)",
                    background: on ? "var(--tint-ember)" : "#fff", color: on ? "var(--rust)" : "var(--navy)",
                  }}>
                  {on ? "✓ " : ""}{o.l}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ justifyContent: "space-between", padding: "14px 0", marginTop: 6 }}>
            <div>
              <p className="ln" style={{ marginBottom: 2 }}>Ab finisher</p>
              <p className="cap">Tick it off during the workout</p>
            </div>
            <button type="button" className={`sw${finisherOn ? " on" : ""}`} aria-pressed={finisherOn} aria-label="Ab finisher" onClick={() => setFinisherOn(!finisherOn)}><span /></button>
          </div>
          <div className="row" style={{ justifyContent: "space-between", padding: "14px 0" }}>
            <div>
              <p className="ln" style={{ marginBottom: 2 }}>Cool-down · 5 min</p>
              <p className="cap">Stretch and breathing</p>
            </div>
            <button type="button" className={`sw${cooldown ? " on" : ""}`} aria-pressed={cooldown} aria-label="Cool-down" onClick={() => setCooldown(!cooldown)}><span /></button>
          </div>
        </div>
      </details>

      <div className="dock">
        <div><StartButton label={disabled ? "Finish your open session first" : `Start ${dayName} →`} disabled={disabled} /></div>
      </div>
    </form>
  );
}
