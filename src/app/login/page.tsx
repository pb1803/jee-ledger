"use client";

import { useActionState } from "react";
import { unlock } from "./actions";

const PASSCODE_LENGTH = 6;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(unlock, {
    error: null,
  });

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6 pb-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold">JEE Track</h1>
        <p className="mt-1 text-sm text-zinc-500">Enter Passcode</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={PASSCODE_LENGTH}
          name="passcode"
          pattern="\d{6}"
          placeholder="••••••"
          aria-label="6-digit passcode"
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-4 text-center text-3xl tracking-[0.5em] text-zinc-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-[52px] rounded-xl bg-sky-600 px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
