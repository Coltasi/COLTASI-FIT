"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startSession } from "./actions";
import { unit, w, type Units } from "@/lib/units";

const WARMUPS = [
  { v: "stairs", l: "Stairs" },
  { v: "elliptical", l: "Elliptical" },
  { v: "treadmill", l: "Treadmill" },
  { v: "rower", l: "Rower" },
];
const FINISHERS = ["Plank series", "KB Russian Twists", "Hanging Leg Raises"];

function StartButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={disabled || pending}>
      {pending ? "Starting…" : label}
    </button>
  );
}

export function StartForm({ dayId, dayName, units, lifts, disabled }: {
  dayId: string; dayName: string; units: Units; disabled: boolean;
  lifts: { key: string; name: string; plan: string; lastKg: number | null }[];
}) {
  const [warmup, setWarmup] = useState("stairs");
  const [finisherOn, setFinisherOn] = useState(true);
  const [finisherIdx, setFinisherIdx] = useState(0);
  const [cooldown, setCooldown] = useState(true);

  return (
    <form action={startSession} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="day_id" value={dayId} />
      <input type="hidden" name="warmup" value={warmup} />
      <input type="hidden" name="finisher" value={finisherOn ? FINISHERS[finisherIdx] : ""} />
      {cooldown ? <input type="hidden" name="cooldown" value="on" /> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p className="lab">Warm-up · 10 min</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          {WARMUPS.map((o) => {
            const on = warmup === o.v;
            return (
              <button
                key={o.v}
                type="button"
                aria-pressed={on}
                onClick={() => setWarmup(on ? "" : o.v)}
                style={{
                  height: 44, borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: on ? "2px solid var(--ember)" : "1px solid var(--line-strong)",
                  background: on ? "var(--tint-ember)" : "#fff", color: on ? "var(--rust)" : "var(--navy)",
                }}
              >
                {o.l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card clip">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 10px" }}>
          <p className="lab">Lifts</p>
          <p className="cap" style={{ fontSize: 12 }}>last time</p>
        </div>
        {lifts.map((l) => (
          <div key={l.key} className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <p className="ln" style={{ marginBottom: 2 }}>{l.name}</p>
              <p className="cap">{l.plan}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {l.lastKg != null ? (
                <><span className="num" style={{ fontSize: 17 }}>{w(l.lastKg, units)}</span> <span className="cap">{unit(units)}</span></>
              ) : (
                <span className="cap">new</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", padding: "14px 16px" }}>
          <div>
            <p className="ln" style={{ marginBottom: 2 }}>Ab finisher</p>
            <p className="cap">
              {FINISHERS[finisherIdx]} ·{" "}
              <button type="button" onClick={() => setFinisherIdx((finisherIdx + 1) % FINISHERS.length)} style={{ background: "none", border: 0, padding: 0, color: "var(--kingfisher-text)", font: "inherit", cursor: "pointer" }}>
                change
              </button>
            </p>
          </div>
          <button type="button" className={`sw${finisherOn ? " on" : ""}`} aria-pressed={finisherOn} aria-label="Ab finisher" onClick={() => setFinisherOn(!finisherOn)}><span /></button>
        </div>
        <div className="row" style={{ justifyContent: "space-between", padding: "14px 16px" }}>
          <div>
            <p className="ln" style={{ marginBottom: 2 }}>Cool-down · 5 min</p>
            <p className="cap">Stretch and breathing</p>
          </div>
          <button type="button" className={`sw${cooldown ? " on" : ""}`} aria-pressed={cooldown} aria-label="Cool-down" onClick={() => setCooldown(!cooldown)}><span /></button>
        </div>
      </div>

      <div className="dock">
        <div><StartButton label={disabled ? "Finish your open session first" : `Start ${dayName}`} disabled={disabled} /></div>
      </div>
    </form>
  );
}
