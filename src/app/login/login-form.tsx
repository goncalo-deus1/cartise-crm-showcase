"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/30"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Palavra-passe</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/30"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-full bg-ink text-[15px] font-semibold text-white transition hover:bg-black/85 disabled:opacity-60"
      >
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
