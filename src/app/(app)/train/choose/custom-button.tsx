"use client";

import { useFormStatus } from "react-dom";
import { IconPlus } from "@/components/icons";

/** Disables itself on the first tap so a double tap can't start two sessions. */
export function CustomButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="card flat" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1.5px dashed var(--mist)", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%", color: "var(--navy)", opacity: pending ? 0.6 : 1 }}>
      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--tint-ember)", color: "var(--rust)", display: "flex", alignItems: "center", justifyContent: "center" }}><IconPlus /></span>
      <span><span className="ln" style={{ display: "block" }}>{pending ? "Starting…" : "Custom workout"}</span><span className="cap">Blank session, add lifts as you go</span></span>
    </button>
  );
}
