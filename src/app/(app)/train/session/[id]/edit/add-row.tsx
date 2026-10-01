"use client";

import { useState, useTransition } from "react";
import { IconPlus } from "@/components/icons";
import { addExercise } from "../../../actions";

export function AddExerciseRow({ sessionId, names }: { sessionId: string; names: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="card flat"
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1.5px dashed var(--mist)", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--tint-blue)", color: "var(--kingfisher-text)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconPlus /></span>
        <span><span className="ln" style={{ display: "block", color: "var(--kingfisher-text)" }}>Add exercise</span><span className="cap">Search the library or type a new one</span></span>
      </button>
    );
  }
  return (
    <form className="card" style={{ padding: 14, display: "grid", gap: 8 }}
      action={(fd) => start(async () => { await addExercise(sessionId, fd); setOpen(false); })}>
      <label><span className="flab">Exercise</span>
        <input name="name" className="fld" list="exercise-names" placeholder="Start typing…" autoFocus required />
      </label>
      <datalist id="exercise-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        <label><span className="flab">Sets</span><input name="sets" className="fld" inputMode="numeric" defaultValue="3" /></label>
        <label><span className="flab">Reps</span><input name="reps" className="fld" placeholder="8–12" /></label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn" style={{ height: 52 }} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      </div>
    </form>
  );
}
