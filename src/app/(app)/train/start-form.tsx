"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { saveFinisher, startSession, undoPlanChange } from "./actions";
import { unit, w, type Units } from "@/lib/units";
import type { Finisher, FinisherMove } from "@/lib/data";
import { IconMinus } from "@/components/icons";
import { Ring, Sheet, linkBtn } from "@/components/sheet";

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

export function StartForm({ dayId, dayName, units, lifts, finishers: initialFinishers, disabled }: {
  dayId: string; dayName: string; units: Units; disabled: boolean; finishers: Finisher[];
  lifts: { key: string; position: number; name: string; plan: string; undo: string | null; lastKg: number | null; hasLast: boolean }[];
}) {
  const [warmup, setWarmup] = useState("stairs");
  const [finisherOn, setFinisherOn] = useState(true);
  const [finishers, setFinishers] = useState(initialFinishers);
  const [finIdx, setFinIdx] = useState(() => Math.max(0, initialFinishers.findIndex((f) => f.is_default)));
  const [cooldown, setCooldown] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [pending, start] = useTransition();
  const fin = finishers[finIdx] as Finisher | undefined;

  const patchMoves = (fn: (m: FinisherMove[]) => FinisherMove[]) =>
    setFinishers((fs) => fs.map((f, i) => (i === finIdx ? { ...f, moves: fn(f.moves) } : f)));
  const closeSheet = () => {
    setSheet(false);
    if (fin) start(() => saveFinisher(fin.id, fin.moves));
  };

  return (
    <>
    <form action={startSession} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="day_id" value={dayId} />
      <input type="hidden" name="warmup" value={warmup} />
      <input type="hidden" name="finisher" value={finisherOn && fin ? fin.name : ""} />
      <input type="hidden" name="finisher_moves" value={finisherOn && fin ? JSON.stringify(fin.moves) : ""} />
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
            <div style={{ minWidth: 0 }}>
              <p className="ln" style={{ marginBottom: 2 }}>{l.name}</p>
              <p className="cap">{l.plan}</p>
              {l.undo ? (
                <button type="button" disabled={pending} style={{ ...linkBtn, fontSize: 13, marginTop: 2 }}
                  onClick={() => start(() => undoPlanChange(dayId, l.position))}>
                  {l.undo}
                </button>
              ) : null}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {l.lastKg != null ? (
                <><span className="num" style={{ fontSize: 17 }}>{w(l.lastKg, units)}</span> <span className="cap">{unit(units)}</span></>
              ) : (
                <span className="cap">{l.hasLast ? "BW" : "new"}</span>
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
              {fin?.name ?? "None"} ·{" "}
              <button type="button" onClick={() => setSheet(true)} style={{ ...linkBtn, fontWeight: 400 }}>edit</button>
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

      {sheet ? (
        <Sheet title="Ab finisher" onClose={closeSheet}>
          <div className="card flat clip">
            {finishers.map((f, i) => {
              const on = i === finIdx;
              return (
                <button key={f.id} type="button" className="row" aria-pressed={on}
                  onClick={() => { setFinIdx(i); setFinisherOn(true); }}
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", borderLeft: 0, borderRight: 0, borderBottom: 0, background: on ? "var(--tint-ember-soft)" : "transparent" }}>
                  <Ring on={on} />
                  <span style={{ flexGrow: 1, minWidth: 0 }}>
                    <span className="ln" style={{ display: "block" }}>{f.name}</span>
                    <span className="cap">{f.moves.map((m) => m.name).join(", ")}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {fin ? (
            <>
              <p className="lab">Moves · {fin.name}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fin.moves.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px 44px", gap: 8 }}>
                    <label><span className="sr-only">Move {i + 1}</span>
                      <input className="fld" value={m.name} placeholder="Move" style={{ height: 44, padding: "0 12px" }}
                        onChange={(e) => { const v = e.target.value; patchMoves((ms) => ms.map((x, j) => (j === i ? { ...x, name: v } : x))); }} />
                    </label>
                    <label><span className="sr-only">Reps or time for move {i + 1}</span>
                      <input className="fld" value={m.dose} placeholder="Reps / time" style={{ height: 44, padding: "0 10px", fontSize: 14, fontWeight: 600, background: "var(--field)" }}
                        onChange={(e) => { const v = e.target.value; patchMoves((ms) => ms.map((x, j) => (j === i ? { ...x, dose: v } : x))); }} />
                    </label>
                    <button type="button" aria-label={`Remove ${m.name || "move"}`} onClick={() => patchMoves((ms) => ms.filter((_, j) => j !== i))}
                      style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid var(--line-strong)", background: "#fff", color: "var(--rust)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                      <IconMinus />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn2" style={{ width: "100%" }} onClick={() => patchMoves((ms) => [...ms, { name: "", dose: "" }])}>+ Add move</button>
            </>
          ) : null}
          <button type="button" className="btn" onClick={closeSheet}>Done</button>
        </Sheet>
      ) : null}
    </>
  );
}
