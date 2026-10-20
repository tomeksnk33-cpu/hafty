"use client";

import Link from "next/link";

import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

export type ClientDefaults = {
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
};

export const emptyClient: ClientDefaults = {
  name: "",
  company: "",
  phone: "",
  email: "",
  notes: "",
};

export function ClientForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: ClientDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <FormError message={state?.message} />

      <FormField label="Nazwa klienta" name="name" errors={state?.errors}>
        <input
          id="name"
          name="name"
          defaultValue={defaults.name}
          required
          autoFocus
          className="input"
          placeholder="np. Jan Kowalski albo Przedszkole nr 4"
        />
      </FormField>

      <FormField label="Firma" name="company" errors={state?.errors}>
        <input
          id="company"
          name="company"
          defaultValue={defaults.company}
          className="input"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Telefon" name="phone" errors={state?.errors}>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaults.phone}
            className="input"
          />
        </FormField>

        <FormField label="E-mail" name="email" errors={state?.errors}>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={defaults.email}
            className="input"
          />
        </FormField>
      </div>

      <FormField label="Notatki" name="notes" errors={state?.errors}>
        <textarea
          id="notes"
          name="notes"
          defaultValue={defaults.notes}
          rows={4}
          className="input"
          placeholder="Np. preferowane kolory, ustalenia, adres wysyłki."
        />
      </FormField>

      <div className="flex gap-2 pt-1">
        <SubmitButton label={submitLabel} pending={pending} />
        <Link href={cancelHref} className="btn-secondary">
          Anuluj
        </Link>
      </div>
    </form>
  );
}
