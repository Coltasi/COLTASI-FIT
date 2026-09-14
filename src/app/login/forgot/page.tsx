"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, type ActionState } from "./actions";

const initialState: ActionState = { sent: false, error: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestReset,
    initialState,
  );

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-sm">
        <h1 className="font-display mb-1.5 text-center text-2xl font-extrabold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted mb-7 text-center text-sm leading-relaxed">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>

        {state.sent ? (
          <p className="text-center text-sm">
            Check your email for a reset link.
          </p>
        ) : (
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

            {state.error && (
              <p className="text-danger mb-2 text-sm">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="bg-blue rounded-xl py-3.5 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(43,127,174,0.25)] disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-muted mt-6 text-center text-sm">
          <Link href="/login" className="text-blue font-semibold">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
