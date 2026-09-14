"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState } from "react";
import { login, type ActionState } from "./actions";

const initialState: ActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center gap-2.5">
          <Image
            src="/icons/icon-192.png"
            alt="Coltasi Fit"
            width={52}
            height={52}
            className="rounded-[14px]"
          />
          <span className="font-display text-base font-extrabold tracking-wide uppercase">
            Coltasi Fit
          </span>
        </div>

        <h1 className="font-display mb-1.5 text-center text-2xl font-extrabold tracking-tight">
          Welcome back
        </h1>
        <p className="text-muted mb-7 text-center text-sm leading-relaxed">
          Log in to track your own workouts, meals, and body-comp scans.
        </p>

        <form action={formAction} className="flex flex-col">
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
            autoComplete="current-password"
            placeholder="••••••••"
            className="border-border bg-surface mb-2 rounded-xl border px-3.5 py-3 text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_3px_8px_rgba(0,0,0,0.03)] outline-none focus:border-blue"
          />

          {state.error && (
            <p className="text-danger mb-2 text-sm">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="bg-blue mt-1.5 rounded-xl py-3.5 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
          >
            {pending ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="text-muted mt-4 text-center text-sm">
          <Link href="/login/forgot" className="text-blue font-semibold">
            Forgot password?
          </Link>
        </p>

        <p className="text-muted mt-6 text-center text-sm">
          New to Coltasi Fit?{" "}
          <Link href="/signup" className="text-blue font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
