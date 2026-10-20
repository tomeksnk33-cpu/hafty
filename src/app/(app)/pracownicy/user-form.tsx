"use client";

import Link from "next/link";
import { useState } from "react";

import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

export type UserDefaults = {
  name: string;
  login: string;
  role: "ADMIN" | "EMPLOYEE";
  canManageRealizations: boolean;
  active: boolean;
};

export const emptyUser: UserDefaults = {
  name: "",
  login: "",
  role: "EMPLOYEE",
  canManageRealizations: false,
  active: true,
};

// Bez znaków łatwych do pomylenia (0/O, 1/l/I), bo hasło zwykle się komuś dyktuje.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function UserForm({
  action,
  defaults,
  mode,
  isSelf = false,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: UserDefaults;
  mode: "create" | "edit";
  /** Edytowane jest własne konto administratora — nie wolno go wyłączyć ani zdegradować. */
  isSelf?: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);
  const [role, setRole] = useState(defaults.role);
  const [password, setPassword] = useState("");

  const isAdmin = role === "ADMIN";

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <FormError message={state?.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Imię i nazwisko" name="name" errors={state?.errors}>
          <input
            id="name"
            name="name"
            defaultValue={defaults.name}
            required
            autoFocus
            className="input"
            placeholder="np. Anna Kowalska"
          />
        </FormField>

        <FormField
          label="Login"
          name="login"
          hint="Małe litery, cyfry, kropka, myślnik lub podkreślenie."
          errors={state?.errors}
        >
          <input
            id="login"
            name="login"
            defaultValue={defaults.login}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            className="input"
            placeholder="np. anna.k"
          />
        </FormField>
      </div>

      <FormField
        label={mode === "create" ? "Hasło" : "Nowe hasło"}
        name="password"
        hint={
          mode === "create"
            ? "Co najmniej 8 znaków. Przekaż je pracownikowi — po zalogowaniu może je zmienić w zakładce z imieniem."
            : "Zostaw puste, żeby nie zmieniać. Wpisane zastąpi dotychczasowe hasło."
        }
        errors={state?.errors}
      >
        <div className="flex gap-2">
          <input
            id="password"
            name="password"
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={mode === "create"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="input font-mono"
          />
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="btn-secondary shrink-0"
          >
            Wygeneruj
          </button>
        </div>
      </FormField>

      <fieldset className="space-y-3">
        <legend className="field-label">Uprawnienia</legend>

        <FormField label="Rola" name="role" errors={state?.errors}>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserDefaults["role"])}
            disabled={isSelf}
            className="input"
          >
            <option value="EMPLOYEE">Pracownik — prowadzi własny dziennik pracy</option>
            <option value="ADMIN">Administrator — wszystko, w tym konta i ceny</option>
          </select>
          {/* Wyszarzone pole nie jest wysyłane, więc rolę własnego konta przekazujemy ukryte. */}
          {isSelf ? <input type="hidden" name="role" value={role} /> : null}
        </FormField>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="canManageRealizations"
            defaultChecked={defaults.canManageRealizations}
            disabled={isAdmin}
            className="mt-0.5 size-4 accent-accent"
          />
          <span>
            Może dodawać i edytować hafty, klientów i nici
            <span className="block text-xs text-muted">
              {isAdmin
                ? "Administrator ma wszystkie uprawnienia."
                : "Nie daje wglądu w ceny ani w konta innych osób."}
            </span>
          </span>
        </label>

        {mode === "edit" ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={defaults.active}
              disabled={isSelf}
              className="mt-0.5 size-4 accent-accent"
            />
            <span>
              Konto aktywne
              <span className="block text-xs text-muted">
                {isSelf
                  ? "Własnego konta nie możesz wyłączyć."
                  : "Wyłączona osoba nie może się zalogować, a jej wpisy w dzienniku zostają."}
              </span>
            </span>
            {isSelf ? <input type="hidden" name="active" value="on" /> : null}
          </label>
        ) : null}
      </fieldset>

      <div className="flex gap-2 pt-1">
        <SubmitButton label={submitLabel} pending={pending} />
        <Link href={cancelHref} className="btn-secondary">
          Anuluj
        </Link>
      </div>
    </form>
  );
}
