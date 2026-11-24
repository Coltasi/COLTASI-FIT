"use client";

import { useState, useTransition } from "react";
import { IconPlus } from "@/components/icons";
import { addExercise } from "../../../actions";
import type { Candidate } from "@/lib/data";
import { lastLine, searchCandidates } from "@/components/exercise-search";
import type { Units } from "@/lib/units";

export function AddExerciseRow({ sessionId, candidates, units }: { sessionId: string; candidates: Candidate[]; units: Units }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const q = name.trim();
  const recent = candidates.filter((c) => c.last).sort((a, b) => (b.last!.date > a.last!.date ? 1 : -1)).slice(0, 6);
  const matches = q ? searchCandidates(candidates, q, 6) : recent;
  const exact = candidates.find((c) => c.name.toLowerCase() === q.toLowerCase()) ?? null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="card flat"
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1.5px dashed var(--mist)", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--tint-ember)", color: "var(--ember-text)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconPlus /></span>
        <span><span className="ln" style={{ display: "block", color: "var(--ember-text)" }}>Add exercise</span><span className="cap">Search the library or type a new one</span></span>
      </button>
    );
  }
  return (
    <form className="card" style={{ padding: 14, display: "grid", gap: 8 }}
      action={(fd) => start(async () => { await addExercise(sessionId, fd); setOpen(false); })}>
      <label><span className="flab">Exercise</span>
        <input name="name" className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KB swings" autoComplete="off" autoFocus required />
      </label>
      {matches.length && !exact ? (
        <div className="card flat clip">
          {matches.map((c) => (
            <button key={c.name} type="button" className="row" onClick={() => setName(c.name)}
              style={{ width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer" }}>
              <span style={{ flexGrow: 1, minWidth: 0 }}>
                <span className="ln" style={{ display: "block" }}>{c.name}</span>
                <span className="cap">{lastLine(c, units)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : name.trim() && !exact ? <p className="cap">No match. It will be added as a new exercise.</p> : exact ? <p className="cap">{lastLine(exact, units)}</p> : null}
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
