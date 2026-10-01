"use client";

import { useActionState, useRef } from "react";
import { IconSend } from "@/components/icons";
import { CoachMark } from "@/components/ui";
import { ask } from "./actions";

const SUGGESTIONS = ["Why is my cut slow?", "Should I add weight on incline press?", "Swap Legs for kettlebell?"];

export function AskBox() {
  const [state, action, pending] = useActionState(ask, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {pending || state ? (
        <div className="card" style={{ padding: 16 }}>
          <p className="cap" style={{ fontWeight: 600 }}>{pending ? "Asking…" : `You asked: ${state?.q}`}</p>
          {state && !pending ? (
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <CoachMark size={22} />
              <p style={{ fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-line" }}>{state.a}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <form ref={formRef} action={action} style={{ position: "fixed", left: 0, right: 0, bottom: 76, padding: "10px 18px 12px", background: "var(--bg)", borderTop: "1px solid var(--line)", zIndex: 20 }}>
        <div style={{ maxWidth: 444, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => { if (inputRef.current) inputRef.current.value = s; formRef.current?.requestSubmit(); }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ flexGrow: 1 }}>
              <span className="sr-only">Ask Coach</span>
              <input ref={inputRef} name="q" className="fld" placeholder="Ask about training, weight or sleep" autoComplete="off" />
            </label>
            <button type="submit" aria-label="Send" disabled={pending}
              style={{ width: 48, height: 48, borderRadius: 14, border: 0, background: "var(--rust)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <IconSend />
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
