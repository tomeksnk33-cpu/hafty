"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import { useUploader } from "@/components/file-uploads";
import { FormError, SubmitButton } from "@/components/form-field";
import {
  ORDER_KIND_LABEL,
  ORDER_KINDS,
  ORDER_MAX_PHOTOS,
  ORDER_PLACEMENT_LABEL,
  ORDER_PLACEMENTS,
} from "@/lib/orders";
import type { UploadedFile } from "@/lib/uploads";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

function Errors({ errors, name }: { errors?: Record<string, string[]>; name: string }) {
  return (
    <>
      {errors?.[name]?.map((message) => (
        <p key={message} className="field-error text-sm">
          {message}
        </p>
      ))}
    </>
  );
}

/** Duży kafelek do zaznaczania — wygodny palcem na ekranie dotykowym i w telefonie. */
const tileClass =
  "flex min-h-16 cursor-pointer items-center justify-center rounded-xl border-2 border-line bg-surface px-4 py-3 text-center text-lg font-medium transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30";

function OrderPhotos({
  value,
  onChange,
}: {
  value: UploadedFile[];
  onChange: (update: (current: UploadedFile[]) => UploadedFile[]) => void;
}) {
  const inputId = useId();
  const { busy, error, handleFiles } = useUploader("zdjecia", (added) =>
    onChange((current) => [...current, ...added].slice(0, ORDER_MAX_PHOTOS)),
    "zlecenia",
  );
  const full = value.length >= ORDER_MAX_PHOTOS;

  return (
    <div>
      {value.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((photo) => (
            <li key={photo.pathname} className="card overflow-hidden">
              <div className="relative aspect-square bg-paper">
                <Image src={photo.url} alt="" fill sizes="200px" className="object-cover" />
              </div>
              <button
                type="button"
                onClick={() => onChange((current) => current.filter((p) => p.pathname !== photo.pathname))}
                className="w-full py-2 text-sm text-accent hover:bg-accent-soft"
              >
                Usuń zdjęcie
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? null : (
        <label
          htmlFor={inputId}
          className="btn-secondary cursor-pointer px-5 py-3 text-base"
          aria-disabled={busy}
        >
          📷 {busy ? "Wysyłam…" : value.length > 0 ? "Dodaj kolejne zdjęcie" : "Dodaj zdjęcie"}
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <p className="field-hint">
        Zdjęcie asortymentu (np. koszulki, czapki). Można zrobić je telefonem — zostanie zmniejszone automatycznie.
        Najwyżej {ORDER_MAX_PHOTOS} zdjęć.
      </p>

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

/** Pola zapisanego szablonu — do edycji. */
export type OrderTemplateDefaults = {
  name: string;
  kind: "HAFT" | "DTF";
  product: string;
  placements: string[];
  placementNotes: string;
  notes: string;
  photos: UploadedFile[];
};

/**
 * Formularz zlecenia (klient) albo szablonu zlecenia (pracownik, na karcie
 * klienta). Szablon ma nazwę i nie ma ilości — ilość klient poda przy zamówieniu.
 */
export function OrderForm({
  action,
  cancelHref,
  template = false,
  defaults,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  template?: boolean;
  defaults?: OrderTemplateDefaults;
  submitLabel?: string;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);
  const [photos, setPhotos] = useState<UploadedFile[]>(defaults?.photos ?? []);
  const errors = state?.errors;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormError message={state?.message} />

      {template ? (
        <section className="card p-5 sm:p-6">
          <label className="mb-3 block text-lg font-semibold" htmlFor="name">
            Nazwa szablonu
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            defaultValue={defaults?.name}
            className="input py-3 text-lg"
            placeholder="np. Polo granat — logo przód lewy"
          />
          <p className="field-hint">Tę nazwę klient zobaczy na kafelku szablonu.</p>
          <Errors errors={errors} name="name" />
        </section>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">1. Rodzaj</h2>
        <div className="grid grid-cols-2 gap-3">
          {ORDER_KINDS.map((kind) => (
            <label key={kind} className={tileClass}>
              <input
                type="radio"
                name="kind"
                value={kind}
                required
                defaultChecked={defaults?.kind === kind}
                className="sr-only"
              />
              {ORDER_KIND_LABEL[kind]}
            </label>
          ))}
        </div>
        <Errors errors={errors} name="kind" />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">2. Asortyment</h2>
        <label className="field-label" htmlFor="product">
          Co mamy oznakować?
        </label>
        <input
          id="product"
          name="product"
          required
          maxLength={200}
          defaultValue={defaults?.product}
          className="input py-3 text-lg"
          placeholder="np. koszulka polo granatowa, czapka z daszkiem"
        />
        <Errors errors={errors} name="product" />

        <div className="mt-4">
          <OrderPhotos value={photos} onChange={setPhotos} />
          <input type="hidden" name="photos" value={JSON.stringify(photos)} />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold">3. Umiejscowienie</h2>
        <p className="mb-3 text-sm text-muted">Zaznacz jedno lub kilka miejsc albo opisz je poniżej.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ORDER_PLACEMENTS.map((placement) => (
            <label key={placement} className={tileClass}>
              <input
                type="checkbox"
                name="placements"
                value={placement}
                defaultChecked={defaults?.placements.includes(placement)}
                className="sr-only"
              />
              {ORDER_PLACEMENT_LABEL[placement]}
            </label>
          ))}
        </div>
        <Errors errors={errors} name="placements" />

        <label className="field-label mt-4" htmlFor="placementNotes">
          Opis umiejscowienia
        </label>
        <textarea
          id="placementNotes"
          name="placementNotes"
          rows={2}
          maxLength={1000}
          defaultValue={defaults?.placementNotes}
          className="input text-base"
          placeholder="np. logo 8 cm na lewej piersi, napis na plecach pod kołnierzem"
        />
        <Errors errors={errors} name="placementNotes" />
      </section>

      <section className="card p-5 sm:p-6">
        {template ? null : (
          <>
            <h2 className="mb-3 text-lg font-semibold">4. Ilość</h2>
            <div className="mb-4 flex items-center gap-3">
              <input
                id="quantity"
                name="quantity"
                inputMode="numeric"
                pattern="[0-9 ]*"
                required
                className="input w-40 py-3 text-center text-2xl font-semibold"
                placeholder="0"
              />
              <span className="text-lg text-muted">szt.</span>
            </div>
            <Errors errors={errors} name="quantity" />
          </>
        )}

        <label className={template ? "mb-3 block text-lg font-semibold" : "field-label"} htmlFor="notes">
          {template ? "4. Opis" : "Uwagi (opcjonalnie)"}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.notes}
          className="input text-base"
          placeholder={template ? "np. kolory nici, wielkość logo, plik z projektem u nas" : "np. termin, kolory nici, rozmiary"}
        />
        <Errors errors={errors} name="notes" />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="[&_button]:px-8 [&_button]:py-4 [&_button]:text-lg">
          <SubmitButton
            label={submitLabel ?? "Wyślij zlecenie"}
            pendingLabel={template ? "Zapisuję…" : "Wysyłam…"}
            pending={pending}
          />
        </div>
        <Link href={cancelHref} className="btn-secondary px-6 py-4 text-lg">
          Anuluj
        </Link>
      </div>
    </form>
  );
}
