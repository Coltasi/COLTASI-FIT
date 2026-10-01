"use client";

import { useActionState } from "react";
import { BackHeader } from "@/components/ui";
import { requestReset, type ActionState } from "./actions";

export default function ForgotPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestReset, { sent: false, error: null });
  return (
    <main className="screen no-tabs" style={{ padding: "22px 24px 40px", gap: 20 }}>
      <BackHeader href="/login" label="Log in" title="Reset password" />
      {state.sent ? (
        <p style={{ fontSize: 15, lineHeight: 1.45 }}>Check your email for a link to set a new password.</p>
      ) : (
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="cap" style={{ fontSize: 14, lineHeight: 1.45 }}>Enter your email and we&apos;ll send you a reset link.</p>
          <label><span className="flab">Email</span><input className="fld" name="email" type="email" autoComplete="email" required /></label>
          {state.error ? <p className="err">{state.error}</p> : null}
          <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </main>
  );
}
