"use client";

import Link from "next/link";
import { useState } from "react";

import type { QuickThread } from "@/app/(app)/nici/actions";
import { DesignFileUploader, PhotoUploader } from "@/components/file-uploads";
import { FormError, FormField, SubmitButton } from "@/components/form-field";
import { ThreadMarkerEditor } from "@/components/thread-marker-editor";
import { ThreadPicker } from "@/components/thread-picker";
import type { MarkerInput } from "@/lib/markers";
import type { UploadedFile } from "@/lib/uploads";
import { useFormSubmit } from "@/lib/use-form-submit";
import type { FormState } from "@/lib/validation";

import type { RealizationDefaults } from "./defaults";

export function RealizationForm({
  action,
  defaults,
  clients,
  productTypes,
  submitLabel,
  cancelHref,
  showPrice,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: RealizationDefaults;
  clients: { id: string; name: string }[];
  productTypes: string[];
  submitLabel: string;
  cancelHref: string;
  /** Pole ceny widzi tylko administrator; akcja i tak ignoruje je u pozostałych. */
  showPrice: boolean;
}) {
  const { state, onSubmit, pending } = useFormSubmit(action);

  // Zdjęcia, nici i znaczniki są ze sobą powiązane, więc ich stan trzyma
  // formularz, a nie poszczególne komponenty.
  const [photos, setPhotos] = useState<UploadedFile[]>(defaults.photos);
  const [threads, setThreads] = useState<QuickThread[]>(defaults.threads);
  const [designFiles, setDesignFiles] = useState<UploadedFile[]>(defaults.designFiles);
  const [markers, setMarkers] = useState<MarkerInput[]>(defaults.markers);

  // Znacznik traci sens, gdy zniknie jego zdjęcie albo nić. Odsiewamy je przy
  // renderowaniu zamiast kasować przy każdej zmianie — dzięki temu usunięcie
  // czegoś przez pomyłkę i cofnięcie tego nie kasuje pracy bezpowrotnie.
  const validMarkers = markers.filter(
    (marker) =>
      photos.some((photo) => photo.pathname === marker.photo) &&
      threads.some((thread) => thread.id === marker.thread),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormError message={state?.message} />

      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <input type="hidden" name="designFiles" value={JSON.stringify(designFiles)} />
      <input type="hidden" name="markers" value={JSON.stringify(validMarkers)} />
      {threads.map((thread) => (
        <input key={thread.id} type="hidden" name="threadIds" value={thread.id} />
      ))}

      <section className="card space-y-5 p-6">
        <h2 className="font-semibold">Podstawowe dane</h2>

        <FormField label="Nazwa realizacji" name="name" errors={state?.errors}>
          <input
            id="name"
            name="name"
            defaultValue={defaults.name}
            required
            autoFocus
            className="input"
            placeholder="np. Logo na polarach — 12 szt."
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Data wykonania" name="executedAt" errors={state?.errors}>
            <input
              id="executedAt"
              name="executedAt"
              type="date"
              defaultValue={defaults.executedAt}
              required
              className="input"
            />
          </FormField>

          <FormField
            label="Klient"
            name="clientId"
            hint="Zostaw puste, jeśli to haft własny."
            errors={state?.errors}
          >
            <select
              id="clientId"
              name="clientId"
              defaultValue={defaults.clientId}
              className="input"
            >
              <option value="">— bez klienta —</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Ilość sztuk" name="quantity" errors={state?.errors}>
            <input
              id="quantity"
              name="quantity"
              inputMode="numeric"
              defaultValue={defaults.quantity}
              required
              className="input"
            />
          </FormField>

          {showPrice ? (
            <FormField
              label="Cena za sztukę"
              name="unitPriceGr"
              hint="W złotych, np. 149,90. Wartość realizacji policzy się sama."
              errors={state?.errors}
            >
              <input
                id="unitPriceGr"
                name="unitPriceGr"
                inputMode="decimal"
                defaultValue={defaults.unitPriceGr}
                className="input"
                placeholder="0,00"
              />
            </FormField>
          ) : null}
        </div>
      </section>

      <section className="card space-y-5 p-6">
        <h2 className="font-semibold">Produkt i haft</h2>

        <FormField label="Typ produktu" name="productType" errors={state?.errors}>
          <input
            id="productType"
            name="productType"
            defaultValue={defaults.productType}
            list="typy-produktow"
            className="input"
            placeholder="np. koszulka polo, czapka, ręcznik"
          />
          <datalist id="typy-produktow">
            {productTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </FormField>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Szerokość (mm)" name="widthMm" errors={state?.errors}>
            <input
              id="widthMm"
              name="widthMm"
              inputMode="numeric"
              defaultValue={defaults.widthMm}
              className="input"
            />
          </FormField>

          <FormField label="Wysokość (mm)" name="heightMm" errors={state?.errors}>
            <input
              id="heightMm"
              name="heightMm"
              inputMode="numeric"
              defaultValue={defaults.heightMm}
              className="input"
            />
          </FormField>

          <FormField label="Liczba ściegów" name="stitchCount" errors={state?.errors}>
            <input
              id="stitchCount"
              name="stitchCount"
              inputMode="numeric"
              defaultValue={defaults.stitchCount}
              className="input"
            />
          </FormField>
        </div>
      </section>

      <section className="card space-y-5 p-6">
        <h2 className="font-semibold">Zdjęcia</h2>
        <PhotoUploader value={photos} onChange={setPhotos} />
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Użyte nici</h2>
          <p className="text-sm text-muted">
            Po tych nićach będzie można później wyszukiwać realizacje.
          </p>
        </div>

        <ThreadPicker value={threads} onChange={setThreads} />

        {state?.errors?.threadIds?.map((message) => (
          <p key={message} className="field-error">
            {message}
          </p>
        ))}
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Nici na zdjęciu</h2>
          <p className="text-sm text-muted">
            Postaw znacznik tam, gdzie użyłeś danej nici. Przy podglądzie realizacji
            zobaczysz numerki na zdjęciu — dzięki temu rozróżnisz nici o zbliżonych
            kolorach.
          </p>
        </div>

        <ThreadMarkerEditor
          photos={photos}
          threads={threads}
          value={validMarkers}
          onChange={setMarkers}
        />

        {state?.errors?.markers?.map((message) => (
          <p key={message} className="field-error">
            {message}
          </p>
        ))}
      </section>

      <section className="card space-y-5 p-6">
        <h2 className="font-semibold">Plik projektu</h2>
        <DesignFileUploader value={designFiles} onChange={setDesignFiles} />
      </section>

      <section className="card space-y-5 p-6">
        <FormField label="Notatki" name="notes" errors={state?.errors}>
          <textarea
            id="notes"
            name="notes"
            defaultValue={defaults.notes}
            rows={4}
            className="input"
            placeholder="Np. ustawienia maszyny, uwagi do powtórki zamówienia."
          />
        </FormField>
      </section>

      <div className="flex gap-2">
        <SubmitButton label={submitLabel} pending={pending} />
        <Link href={cancelHref} className="btn-secondary">
          Anuluj
        </Link>
      </div>
    </form>
  );
}
