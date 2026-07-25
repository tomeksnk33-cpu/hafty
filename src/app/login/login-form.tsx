"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { logIn } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Sprawdzam…" : "Zaloguj się"}
    </button>
  );
}

export function LoginForm({ powrot }: { powrot: string }) {
  const [state, formAction] = useActionState(logIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="powrot" value={powrot} />

      <div>
        <label className="field-label" htmlFor="password">
          Hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="input"
        />
      </div>

      {state?.message ? (
        <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
