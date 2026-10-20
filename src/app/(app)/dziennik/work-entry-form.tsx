"use client";

import Link from "next/link";
import { useState } from "react";

import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

import type { RealizationOption } from "./realization-options";

export type WorkEntryDefaults = {
  workDate: string;
  realizationId: string;
  quantity: string;
  notes: string;
};

/** Do wyszukiwania bez względu na wielkość liter i polskie znaki ("lodz" znajdzie "Łódź"). */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/gi, "l")
    .toLowerCase();
}

function RealizationSelect({
  options,
  defaultValue,
  emptyLabel,
}: {
  options: RealizationOption[];
  defaultValue: string;
  /** Etykieta pustej opcji — przy usuniętej realizacji pokazuje jej zapisaną nazwę. */
  emptyLabel: string;
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(defaultValue);

  const needle = fold(filter.trim());

  // Wybrana pozycja zostaje na liście nawet po odfiltrowaniu, żeby wybór nie znikał.
  const visible = options.filter(
    (option) => option.id === selected || needle === "" || fold(option.label).includes(needle),
  );

  const matches = visible.filter((option) => option.id !== selected).length;

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Szukaj realizacji po nazwie lub kliencie…"
        aria-label="Szukaj realizacji"
        className="input"
      />

      <select
        id="realizationId"
        name="realizationId"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="input"
      >
        <option value="">{emptyLabel}</option>
        {visible.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {needle !== "" && matches === 0 ? (
        <p className="field-hint">Nic nie pasuje do „{filter.trim()}”.</p>
      ) : null}
    </div>
  );
}

export function WorkEntryForm({
  action,
  defaults,
  realizations,
  submitLabel,
  cancelHref,
  userId,
  minDate,
  maxDate,
  orphanLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: WorkEntryDefaults;
  realizations: RealizationOption[];
  submitLabel: string;
  /** Tylko przy edycji — przy dodawaniu formularz stoi na stronie listy. */
  cancelHref?: string;
  /** Ustawiany przez administratora, gdy dodaje wpis za kogoś innego. */
  userId?: string;
  minDate?: string;
  maxDate: string;
  /** Zapisana nazwa usuniętej realizacji. */
  orphanLabel?: string;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);

  return (
    // Zmiana `key` po udanym zapisie odtwarza formularz od zera — czyści pola
    // i wyszukiwarkę, żeby można było od razu wpisać kolejną pozycję. Po błędzie
    // `key` się nie zmienia, więc wpisane dane zostają.
    <form key={state?.savedAt ?? "nowy"} onSubmit={onSubmit} className="space-y-4">
      {userId ? <input type="hidden" name="userId" value={userId} /> : null}

      {state?.ok ? (
        <p role="status" className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
          ✓ {state.message}
        </p>
      ) : (
        <FormError message={state?.message} />
      )}

      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <FormField label="Data pracy" name="workDate" errors={state?.errors}>
          <input
            id="workDate"
            name="workDate"
            type="date"
            defaultValue={defaults.workDate}
            min={minDate}
            max={maxDate}
            required
            className="input"
          />
        </FormField>

        <FormField label="Realizacja" name="realizationId" errors={state?.errors}>
          <RealizationSelect
            options={realizations}
            defaultValue={defaults.realizationId}
            emptyLabel={orphanLabel ?? "— wybierz realizację —"}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <FormField label="Ilość sztuk" name="quantity" errors={state?.errors}>
          <input
            id="quantity"
            name="quantity"
            inputMode="numeric"
            defaultValue={defaults.quantity}
            required
            className="input"
            placeholder="np. 25"
          />
        </FormField>

        <FormField label="Notatka" name="notes" errors={state?.errors}>
          <input
            id="notes"
            name="notes"
            defaultValue={defaults.notes}
            className="input"
            placeholder="Opcjonalnie, np. maszyna 2, brak jednego koloru"
          />
        </FormField>
      </div>

      <div className="flex gap-2">
        <SubmitButton label={submitLabel} pending={pending} />
        {cancelHref ? (
          <Link href={cancelHref} className="btn-secondary">
            Anuluj
          </Link>
        ) : null}
      </div>
    </form>
  );
}
