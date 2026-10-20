"use client";

import Link from "next/link";

import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

export type ThreadDefaults = {
  brand: string;
  number: string;
  colorName: string;
  hex: string;
};

export const emptyThread: ThreadDefaults = {
  brand: "",
  number: "",
  colorName: "",
  hex: "",
};

export function ThreadForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: ThreadDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <FormError message={state?.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Producent" name="brand" errors={state?.errors}>
          <input
            id="brand"
            name="brand"
            defaultValue={defaults.brand}
            required
            autoFocus
            list="producenci"
            className="input"
            placeholder="np. Madeira"
          />
          <datalist id="producenci">
            <option value="Madeira" />
            <option value="Gunold" />
            <option value="Ariadna" />
            <option value="Isacord" />
            <option value="Sulky" />
          </datalist>
        </FormField>

        <FormField label="Numer nici" name="number" errors={state?.errors}>
          <input
            id="number"
            name="number"
            defaultValue={defaults.number}
            required
            className="input"
            placeholder="np. 1147"
          />
        </FormField>
      </div>

      <FormField label="Nazwa koloru" name="colorName" errors={state?.errors}>
        <input
          id="colorName"
          name="colorName"
          defaultValue={defaults.colorName}
          className="input"
          placeholder="np. ciemny granat"
        />
      </FormField>

      <FormField
        label="Kolor podglądu"
        name="hex"
        hint="Opcjonalnie — ułatwia rozpoznanie nici na liście."
        errors={state?.errors}
      >
        <input
          id="hex"
          name="hex"
          defaultValue={defaults.hex}
          className="input"
          placeholder="#1b2a4a"
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
