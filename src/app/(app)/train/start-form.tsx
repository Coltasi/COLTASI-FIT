"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startSession } from "./actions";
import { unit, w, type Units } from "@/lib/units";
import type { Finisher } from "@/lib/data";
import { WarmupLength } from "@/components/warmup-length";
import { DEFAULT_WARMUP_MIN } from "@/lib/warmup";

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
  const [warmup, setWarmup] = useState("treadmill");
  const [warmupMin, setWarmupMin] = useState(DEFAULT_WARMUP_MIN);
  const [finisherOn, setFinisherOn] = useState(true);
  const [cooldown, setCooldown] = useState(true);
  const fin = (finishers.find((f) => f.is_default) ?? finishers[0]) as Finisher | undefined;

  return (
    <form action={startSession} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <input type="hidden" name="day_id" value={dayId} />
      <input type="hidden" name="warmup" value={warmup} />
      <input type="hidden" name="warmup_min" value={warmupMin} />
      <input type="hidden" name="finisher" value={finisherOn && fin ? fin.name : ""} />
      <input type="hidden" name="finisher_moves" value={finisherOn && fin ? JSON.stringify(fin.moves) : ""} />
      {cooldown ? <input type="hidden" name="cooldown" value="on" /> : null}

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="sec">Warm-up</h2>
        <details className="card">
          <summary style={{ listStyle: "none", padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
            <span className="ln">{warmup ? `${WARMUPS.find((o) => o.v === warmup)?.l} · ${warmupMin} min` : "No warm-up"}</span>
            <span className="pill">Edit</span>
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderTop: "1px solid var(--line-soft)" }}>
            <p className="lab">Machine</p>
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
            {warmup ? (
              <>
                <p className="lab" style={{ marginTop: 8 }}>Length</p>
                <WarmupLength value={warmupMin} onChange={setWarmupMin} />
              </>
            ) : null}
          </div>
        </details>
      </section>

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

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="sec">After your lifts</h2>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", padding: 16 }}>
            <div>
              <p className="ln">Ab finisher</p>
              <p className="cap">Tick it off during the workout</p>
            </div>
            <button type="button" className={`sw${finisherOn ? " on" : ""}`} aria-pressed={finisherOn} aria-label="Ab finisher" onClick={() => setFinisherOn(!finisherOn)}><span /></button>
          </div>
          <div className="row" style={{ justifyContent: "space-between", padding: 16 }}>
            <div>
              <p className="ln">Cool-down · 5 min</p>
              <p className="cap">Stretch and breathing</p>
            </div>
            <button type="button" className={`sw${cooldown ? " on" : ""}`} aria-pressed={cooldown} aria-label="Cool-down" onClick={() => setCooldown(!cooldown)}><span /></button>
          </div>
        </div>
      </section>

      <div className="dock">
        <div><StartButton label={disabled ? "Finish your open session first" : `Start ${dayName} →`} disabled={disabled} /></div>
      </div>
    </form>
  );
}
