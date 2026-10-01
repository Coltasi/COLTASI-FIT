"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type ActionState } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, { error: null });
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label><span className="flab">Email</span><input className="fld" name="email" type="email" autoComplete="email" placeholder="you@email.com" required /></label>
        <label><span className="flab">Password</span><input className="fld" name="password" type="password" autoComplete="current-password" required /></label>
        <Link href="/login/forgot" style={{ fontSize: 13, fontWeight: 600, alignSelf: "flex-end" }}>Forgot password?</Link>
      </div>
      {notice ? <p className="cap" style={{ color: "var(--kingfisher-text)", fontWeight: 600 }}>{notice}</p> : null}
      {state.error ? <p className="err">{state.error}</p> : null}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
