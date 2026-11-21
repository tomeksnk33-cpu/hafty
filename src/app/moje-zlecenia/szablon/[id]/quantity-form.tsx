"use client";

import Link from "next/link";

import { FormError, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

/** Zlecenie z szablonu — klient wpisuje tylko ilość. */
export function QuantityForm({ action }: { action: (state: FormState, formData: FormData) => Promise<FormState> }) {
  const { state, onSubmit, pending } = useFormSubmit(action);

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5 sm:p-6">
      <FormError message={state?.message} />
      <label htmlFor="quantity" className="block text-lg font-semibold">
        Ilość
      </label>
      <div className="flex items-center gap-3">
        <input
          id="quantity"
          name="quantity"
          inputMode="numeric"
          pattern="[0-9 ]*"
          required
          autoFocus
          className="input w-44 py-4 text-center text-3xl font-semibold"
          placeholder="0"
        />
        <span className="text-xl text-muted">szt.</span>
      </div>
      {state?.errors?.quantity?.map((message) => (
        <p key={message} className="field-error text-sm">
          {message}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <div className="[&_button]:px-8 [&_button]:py-4 [&_button]:text-lg">
          <SubmitButton label="Wyślij zlecenie" pendingLabel="Wysyłam…" pending={pending} />
        </div>
        <Link href="/moje-zlecenia" className="btn-secondary px-6 py-4 text-lg">
          Anuluj
        </Link>
      </div>
    </form>
  );
}
