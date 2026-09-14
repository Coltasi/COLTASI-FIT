"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState } from "react";
import { signup, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <Image
            src="/icons/icon-192.png"
            alt="Coltasi Fit"
            width={44}
            height={44}
            className="rounded-xl"
          />
          <span className="font-display text-base font-extrabold tracking-wide uppercase">
            Coltasi Fit
          </span>
        </div>

        <h1 className="font-display mb-1.5 text-center text-2xl font-extrabold tracking-tight">
          Create your account
        </h1>
        <p className="text-muted mb-7 text-center text-sm leading-relaxed">
          Your own login for workouts, meals, sleep, and body-comp scans —
          separate from anyone else using the app.
        </p>

        <form action={formAction} className="flex flex-col">
          <label className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
            Name
          </label>
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            placeholder="Your name"
            className="border-border bg-surface mb-4 rounded-xl border px-3.5 py-3 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_3px_8px_rgba(0,0,0,0.03)] outline-none focus:border-blue"
          />

          <label className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@email.com"
            className="border-border bg-surface mb-4 rounded-xl border px-3.5 py-3 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_3px_8px_rgba(0,0,0,0.03)] outline-none focus:border-blue"
          />

          <label className="text-muted mb-1.5 text-xs font-bold tracking-wide uppercase">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="border-border bg-surface mb-5 rounded-xl border px-3.5 py-3 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_3px_8px_rgba(0,0,0,0.03)] outline-none focus:border-blue"
          />

          <div className="border-border bg-surface mb-5 rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
            <p className="mb-1.5 text-[13px] font-bold">
              Joining someone&apos;s household?
            </p>
            <p className="text-muted mb-3 text-xs leading-relaxed">
              If someone else already uses Coltasi Fit, enter their household
              invite code below. You still get your own account — your data
              (workouts, meals, scans) stays fully separate.
            </p>
            <input
              type="text"
              name="invite_code"
              placeholder="Household invite code (optional)"
              className="border-border w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </div>

          {state.error && (
            <p className="text-danger mb-2 text-sm">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="bg-blue rounded-xl py-3.5 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
          >
            {pending ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-muted-2 mt-4 text-center text-[11px] leading-relaxed">
          By creating an account you agree to sync your health data (workouts,
          nutrition, sleep, and body-composition scans) to your own private
          account.
        </p>

        <p className="text-muted mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-blue font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
