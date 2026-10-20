"use client";

import { useEffect, useRef } from "react";

import { useFormSubmit } from "@/lib/use-form-submit";

import { logIn } from "./actions";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Sprawdzam…" : "Zaloguj się"}
    </button>
  );
}

export function LoginForm({ powrot }: { powrot: string }) {
  const { state, onSubmit, pending } = useFormSubmit(logIn);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Po nieudanym logowaniu login zostaje, a hasło czyścimy i wracamy do niego kursorem.
  useEffect(() => {
    if (state?.message && passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="powrot" value={powrot} />

      <div>
        <label className="field-label" htmlFor="login">
          Login
        </label>
        <input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          className="input"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Hasło
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      {state?.message ? (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {state.message}
        </p>
      ) : null}

      <SubmitButton pending={pending} />
    </form>
  );
}
