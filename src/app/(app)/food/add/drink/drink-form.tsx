"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { DRINKS, drinkName, type DrinkKind } from "@/lib/drinks";
import { logDrink } from "../../actions";

/** Pick a drink and how many; the calories are worked out from a standard serving. */
export function DrinkForm({ day, done }: { day: string; done: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<DrinkKind | null>(null);
  const [count, setCount] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const kcal = kind ? DRINKS[kind].kcal * count : null;

  function save() {
    if (!kind) return;
    setErr(null);
    start(async () => {
      const r = await logDrink(kind, count, day);
      if (r.error) setErr(r.error);
      else { router.push(done); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <p className="ln" style={{ marginBottom: 10 }}>What did you have?</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
          {(Object.keys(DRINKS) as DrinkKind[]).map((k) => {
            const on = kind === k;
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => setKind(k)}
                style={{ minHeight: 84, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, cursor: "pointer", font: "inherit", textAlign: "left", color: "var(--navy)",
                  border: on ? "2px solid var(--navy)" : "1px solid var(--line-strong)", background: on ? "var(--cream)" : "#fff" }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{DRINKS[k].label}</span>
                <span className="cap">{DRINKS[k].serving}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="ln" style={{ marginBottom: 10 }}>How many?</p>
        <div className="card" style={{ padding: "18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" aria-label="One fewer" onClick={() => setCount((c) => Math.max(1, c - 1))} style={stepper}>−</button>
          <div style={{ textAlign: "center" }}>
            <span className="disp" style={{ fontSize: 48, lineHeight: 1 }}>{count}</span>
            <p className="cap" style={{ fontWeight: 600 }}>{kind ? (count === 1 ? DRINKS[kind].one : DRINKS[kind].many) : count === 1 ? "drink" : "drinks"}</p>
          </div>
          <button type="button" aria-label="One more" onClick={() => setCount((c) => Math.min(20, c + 1))} style={stepper}>+</button>
        </div>
      </div>

      {kcal != null ? (
        <>
          <div style={{ background: "var(--navy)", color: "#fff", borderRadius: 16, padding: "18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--on-navy-muted)" }}>Adds about</span>
            <span className="disp" style={{ fontSize: 30, color: "#fff" }}>{kcal.toLocaleString("en-US")} kcal</span>
          </div>
          <p className="cap" style={{ marginTop: -12, lineHeight: 1.45 }}>Estimated from a standard serving. You can change it in Edit afterwards.</p>
        </>
      ) : null}

      {err ? <p className="err">{err}</p> : null}
      <div className="dock"><div>
        <button type="button" className="btn" disabled={!kind || pending} onClick={save}>
          {pending ? "Adding…" : kind ? `Add ${drinkName(kind, count)}` : "Pick a drink"}
        </button>
      </div></div>
    </div>
  );
}

const stepper: CSSProperties = {
  width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--line-strong)", background: "var(--bg)",
  fontSize: 24, fontWeight: 600, color: "var(--navy)", cursor: "pointer",
};
