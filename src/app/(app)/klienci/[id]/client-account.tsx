"use client";

import { useState } from "react";

import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

/** Login i hasło, którymi klient loguje się, żeby składać zlecenia. */
export function ClientAccountForm({
  action,
  login,
  hasAccount,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  login: string;
  hasAccount: boolean;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);
  const [showPassword, setShowPassword] = useState(true);

  return (
    <form key={state?.savedAt ?? "konto"} onSubmit={onSubmit} className="space-y-4">
      {state?.ok ? (
        <p role="status" className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
          ✓ {state.message}
        </p>
      ) : (
        <FormError message={state?.message} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Login klienta" name="login" errors={state?.errors} hint="Małe litery, cyfry, kropka, myślnik.">
          <input
            id="login"
            name="login"
            defaultValue={login}
            required
            autoComplete="off"
            autoCapitalize="none"
            className="input"
            placeholder="np. przedszkole4"
          />
        </FormField>

        <FormField
          label={hasAccount ? "Nowe hasło" : "Hasło"}
          name="password"
          errors={state?.errors}
          hint={hasAccount ? "Zostaw puste, żeby nie zmieniać hasła." : "Co najmniej 8 znaków. Przekaż je klientowi."}
        >
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required={!hasAccount}
            autoComplete="new-password"
            className="input"
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
        Pokaż hasło
      </label>

      <SubmitButton
        label={hasAccount ? "Zapisz zmiany konta" : "Załóż konto klienta"}
        pending={pending}
      />
    </form>
  );
}
