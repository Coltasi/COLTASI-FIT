"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { IconBack } from "@/components/icons";
import { signup, type ActionState } from "./actions";

export default function SignUpPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signup, { error: null });
  const [joining, setJoining] = useState(false);
  return (
    <main className="screen no-tabs" style={{ padding: "22px 24px 40px", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/login" className="iconbtn" aria-label="Back to Log in"><IconBack /></Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={34} height={34} />
        <span className="disp" style={{ fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>Coltasi Fit</span>
      </div>
      <div>
        <h1 className="disp" style={{ fontSize: 26 }}>Create your account</h1>
        <p className="cap" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.45 }}>Your own login. Workouts, weigh-ins, scans and sleep stay separate from anyone else on the app.</p>
      </div>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label><span className="flab">Name</span><input className="fld" name="name" autoComplete="name" placeholder="Your name" required /></label>
          <label><span className="flab">Email</span><input className="fld" name="email" type="email" autoComplete="email" placeholder="you@email.com" required /></label>
          <label><span className="flab">Password</span><input className="fld" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required /></label>
        </div>
        <div className="card cream" style={{ padding: "14px 16px" }}>
          <p className="ln">Joining someone&apos;s household?</p>
          {joining ? (
            <label style={{ display: "block", marginTop: 10 }}>
              <span className="flab">Invite code</span>
              <input className="fld" name="invite_code" autoCapitalize="characters" placeholder="From their Settings" />
            </label>
          ) : (
            <p className="cap" style={{ lineHeight: 1.45 }}>
              Enter the invite code from their Settings. You still get your own data, not a shared login.{" "}
              <button type="button" onClick={() => setJoining(true)} style={{ background: "none", border: 0, padding: 0, color: "var(--kingfisher-text)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Add code</button>
            </p>
          )}
        </div>
        {state.error ? <p className="err">{state.error}</p> : null}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
        <p className="cap" style={{ fontSize: 12, lineHeight: 1.45, textAlign: "center" }}>Your training, weight, sleep and body-composition data is stored privately in your own account.</p>
      </form>
    </main>
  );
}
