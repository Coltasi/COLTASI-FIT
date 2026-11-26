"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { discardSession, restartSession, switchWorkout } from "../../actions";

type Choice = "restart" | "switch" | "discard";

const CHOICES: { key: Choice; title: string; sub: string; confirm: string; button: string }[] = [
  { key: "restart", title: "Start over", sub: "Clear every set and tick. Keeps today's lifts.", confirm: "Every logged set, skip and tick in this workout goes back to blank. The lifts stay.", button: "Clear and start over" },
  { key: "switch", title: "Do a different workout", sub: "Throw this one away and pick another.", confirm: "This workout and anything logged in it will be deleted. You'll pick a new one next.", button: "Delete and pick another" },
  { key: "discard", title: "Discard workout", sub: "Delete it. Nothing is saved.", confirm: "This workout and anything logged in it will be deleted.", button: "Delete workout" },
];

/** In-progress only: start over, swap to another workout, or throw it away. Each asks once before doing anything. */
export function WorkoutOptions({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Choice | null>(null);
  const [pending, start] = useTransition();
  const close = () => { setOpen(false); setPick(null); };
  const chosen = CHOICES.find((c) => c.key === pick);

  function go(c: Choice) {
    start(async () => {
      if (c === "restart") await restartSession(sessionId);
      else if (c === "switch") await switchWorkout(sessionId);
      else await discardSession(sessionId);
    });
  }

  return (
    <>
      <button type="button" className="btn2" onClick={() => setOpen(true)} style={{ marginTop: 6 }}>Options</button>
      {open ? (
        <Sheet title={chosen ? chosen.title : "Workout options"} onClose={close}>
          {chosen ? (
            <>
              <p style={{ fontSize: 16, lineHeight: 1.45 }}>{chosen.confirm}</p>
              <button type="button" className="btn" disabled={pending} onClick={() => go(chosen.key)}
                style={{ background: "var(--crimson)" }}>{pending ? "Working…" : chosen.button}</button>
              <button type="button" className="ghost" disabled={pending} onClick={() => setPick(null)}>Back</button>
            </>
          ) : (
            <div className="card" style={{ padding: "0 16px" }}>
              <div className="list">
                {CHOICES.map((c, i) => (
                  <button key={c.key} type="button" className="li" onClick={() => setPick(c.key)}
                    style={{ width: "100%", background: "none", border: 0, borderBottom: i < CHOICES.length - 1 ? "1px solid var(--line-strong)" : 0, textAlign: "left", cursor: "pointer", font: "inherit" }}>
                    <span>
                      <span className="t" style={{ display: "block", color: c.key === "restart" ? "var(--navy)" : "var(--crimson)" }}>{c.title}</span>
                      <span className="s" style={{ display: "block" }}>{c.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      ) : null}
    </>
  );
}
