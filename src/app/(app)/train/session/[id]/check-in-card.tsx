"use client";

import { useState } from "react";
import { FEELS, FEEL_LABEL, NOTE_MAX, PAIN_AREAS, PAIN_LABEL, type Feel, type PainArea } from "@/lib/check-in";

/**
 * Optional notes for the Coach, shown above Finish. All fields belong to the Finish form
 * (via `form=`), so nothing is saved until the workout is finished.
 */
export function CheckInCard({ formId, initial }: { formId: string; initial?: { feel: string | null; pains: string[]; notes: string | null } }) {
  const [open, setOpen] = useState(false);
  const [feel, setFeel] = useState<Feel | null>((initial?.feel as Feel | null) ?? null);
  const [pains, setPains] = useState<PainArea[]>((initial?.pains ?? []) as PainArea[]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const togglePain = (p: PainArea) => setPains((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const filled = !!feel || pains.length > 0 || notes.trim().length > 0;

  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Hidden copies so the values submit with Finish even while the card is collapsed. */}
      {feel ? <input type="hidden" name="feel" value={feel} form={formId} /> : null}
      {pains.map((p) => <input key={p} type="hidden" name="pain" value={p} form={formId} />)}
      <input type="hidden" name="notes" value={notes} form={formId} />

      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
        <div style={{ flexGrow: 1 }}>
          <p className="lab" style={{ color: "var(--navy)" }}>Notes for Coach · optional</p>
          <p className="cap">{filled ? summary(feel, pains, notes) : "Sick, tired, or something niggling? Tell Coach."}</p>
        </div>
        <span className="cap" style={{ color: "var(--kingfisher-text)", flexShrink: 0 }}>{open ? "Done" : filled ? "Edit" : "Add"}</span>
      </button>

      {open ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="lab">How did you feel?</p>
            <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", marginRight: 0, paddingRight: 0 }}>
              {FEELS.map((f) => (
                <button key={f} type="button" className={`chip${feel === f ? " on" : ""}`} onClick={() => setFeel(feel === f ? null : f)}>{FEEL_LABEL[f]}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="lab">Any pain or niggles?</p>
            <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", marginRight: 0, paddingRight: 0 }}>
              {PAIN_AREAS.map((p) => (
                <button key={p} type="button" className={`chip${pains.includes(p) ? " on" : ""}`} onClick={() => togglePain(p)}>{PAIN_LABEL[p]}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="lab">Anything else?</p>
            <textarea className="fld" maxLength={NOTE_MAX} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Head cold, no energy. Left shoulder twinged on overhead press." />
          </div>
        </>
      ) : null}
    </div>
  );
}

function summary(feel: Feel | null, pains: PainArea[], notes: string) {
  const bits = [feel ? FEEL_LABEL[feel] : null, pains.length ? `Pain: ${pains.map((p) => PAIN_LABEL[p]).join(", ")}` : null, notes.trim() ? "Note added" : null];
  return bits.filter(Boolean).join(" · ");
}
