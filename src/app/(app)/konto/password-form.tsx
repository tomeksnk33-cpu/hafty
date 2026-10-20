"use client";

import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";

import { changeOwnPassword } from "./actions";

export function PasswordForm() {
  const { state, onSubmit, pending } = useFormSubmit(changeOwnPassword);

  return (
    // Zmiana `key` po udanym zapisie czyści pola z hasłami.
    <form key={state?.savedAt ?? "nowy"} onSubmit={onSubmit} className="space-y-5">
      {state?.ok ? (
        <p role="status" className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
          ✓ {state.message}
        </p>
      ) : (
        <FormError message={state?.message} />
      )}

      <FormField label="Obecne hasło" name="current" errors={state?.errors}>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Nowe hasło"
          name="next"
          hint="Co najmniej 8 znaków."
          errors={state?.errors}
        >
          <input
            id="next"
            name="next"
            type="password"
            autoComplete="new-password"
            required
            className="input"
          />
        </FormField>

        <FormField label="Powtórz nowe hasło" name="repeat" errors={state?.errors}>
          <input
            id="repeat"
            name="repeat"
            type="password"
            autoComplete="new-password"
            required
            className="input"
          />
        </FormField>
      </div>

      <SubmitButton label="Zmień hasło" pending={pending} />
    </form>
  );
}
