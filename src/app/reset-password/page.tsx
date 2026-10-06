"use client";

import { useActionState } from "react";
import { setNewPassword } from "./actions";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(setNewPassword, { error: null as string | null });
  return (
    <main className="screen no-tabs" style={{ padding: "22px 24px 40px", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={34} height={34} />
        <span className="disp" style={{ fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>Coltasi</span>
      </div>
      <h1 className="disp" style={{ fontSize: 26 }}>Set a new password</h1>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label><span className="flab">New password</span><input className="fld" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label><span className="flab">Confirm it</span><input className="fld" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
        {state.error ? <p className="err">{state.error}</p> : null}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>
      </form>
    </main>
  );
}
