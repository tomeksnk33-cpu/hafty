"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import { useUploader } from "@/components/file-uploads";
import { FormError, SubmitButton } from "@/components/form-field";
import {
  ORDER_KIND_LABEL,
  ORDER_KINDS,
  ORDER_MAX_LOGO_PHOTOS,
  ORDER_MAX_LOGOS,
  ORDER_MAX_PHOTOS,
  ORDER_PLACEMENT_LABEL,
  ORDER_PLACEMENTS,
  type OrderPlacementValue,
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

function OrderPhotos({
  value,
  onChange,
  max = ORDER_MAX_PHOTOS,
  noun = "zdjęcie",
  hint,
}: {
  value: UploadedFile[];
  onChange: (update: (current: UploadedFile[]) => UploadedFile[]) => void;
  max?: number;
  /** „zdjęcie” albo „zdjęcie logo” — na przycisku. */
  noun?: string;
  hint: string;
}) {
  const inputId = useId();
  const { busy, error, handleFiles } = useUploader("zdjecia", (added) =>
    onChange((current) => [...current, ...added].slice(0, max)),
    "zlecenia",
  );
  const full = value.length >= max;

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
          📷 {busy ? "Wysyłam…" : value.length > 0 ? `Dodaj kolejne ${noun}` : `Dodaj ${noun}`}
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
        {hint} Najwyżej {max} zdjęć.
      </p>

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

type LogoKind = "HAFT" | "DTF";

/** Logo w formularzu. Pusty rodzaj/miejsce = jeszcze niewybrane; „INNE" = miejsce tylko w opisie. */
type LogoDraft = {
  key: number;
  kind: LogoKind | "";
  placement: OrderPlacementValue | "INNE" | "";
  description: string;
  photos: UploadedFile[];
};

export type OrderLogoDefaults = {
  kind: LogoKind;
  placement: OrderPlacementValue | null;
  description: string | null;
  photos?: UploadedFile[];
};

/** Pola zapisanego szablonu — do edycji. */
export type OrderTemplateDefaults = {
  name: string;
  product: string;
  logos: OrderLogoDefaults[];
  notes: string;
  photos: UploadedFile[];
};

// Klucze liczone od zera w każdym formularzu (nie globalny licznik), żeby
// HTML z serwera i z przeglądarki miał te same id pól.
function emptyLogo(key: number): LogoDraft {
  return { key, kind: "", placement: "", description: "", photos: [] };
}

function nextKey(logos: LogoDraft[]) {
  return logos.reduce((max, logo) => Math.max(max, logo.key), -1) + 1;
}

function toDraft(logo: OrderLogoDefaults, key: number): LogoDraft {
  return {
    key,
    kind: logo.kind,
    placement: logo.placement ?? "INNE",
    description: logo.description ?? "",
    photos: logo.photos ?? [],
  };
}

/** Postać wysyłana do serwera (walidacja w lib/validation.ts). */
function serializeLogos(logos: LogoDraft[]) {
  return JSON.stringify(
    logos.map((logo) => ({
      kind: logo.kind,
      placement: logo.placement === "" || logo.placement === "INNE" ? null : logo.placement,
      description: logo.description,
      photos: logo.photos,
    })),
  );
}

const choiceClass = (active: boolean) =>
  `flex min-h-14 items-center justify-center rounded-xl border-2 px-3 py-2 text-center text-base font-medium transition-colors sm:text-lg ${
    active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-paper"
  }`;

function LogoCard({
  logo,
  index,
  canRemove,
  errors,
  onChange,
  onPhotos,
  onRemove,
}: {
  logo: LogoDraft;
  index: number;
  canRemove: boolean;
  errors?: Record<string, string[]>;
  onChange: (patch: Partial<LogoDraft>) => void;
  onPhotos: (update: (current: UploadedFile[]) => UploadedFile[]) => void;
  onRemove: () => void;
}) {
  const descriptionId = `logo-${logo.key}-opis`;
  const messages = [
    ...(errors?.[`logos.${index}.kind`] ?? []),
    ...(errors?.[`logos.${index}.placement`] ?? []),
    ...(errors?.[`logos.${index}`] ?? []),
    ...(errors?.[`logos.${index}.description`] ?? []),
  ];

  return (
    <li className="rounded-xl border border-line bg-paper/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Logo {index + 1}</h3>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            ✕ Usuń logo
          </button>
        ) : null}
      </div>

      <p className="mb-2 text-sm font-medium text-muted">Rodzaj</p>
      <div className="grid grid-cols-2 gap-3" role="group" aria-label={`Rodzaj logo ${index + 1}`}>
        {ORDER_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={logo.kind === kind}
            onClick={() => onChange({ kind })}
            className={choiceClass(logo.kind === kind)}
          >
            {ORDER_KIND_LABEL[kind]}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-2 text-sm font-medium text-muted">Miejsce</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label={`Miejsce logo ${index + 1}`}>
        {[...ORDER_PLACEMENTS, "INNE" as const].map((placement) => (
          <button
            key={placement}
            type="button"
            aria-pressed={logo.placement === placement}
            onClick={() => onChange({ placement })}
            className={choiceClass(logo.placement === placement)}
          >
            {placement === "INNE" ? "Inne (opis)" : ORDER_PLACEMENT_LABEL[placement]}
          </button>
        ))}
      </div>

      <label className="field-label mt-4" htmlFor={descriptionId}>
        Opis logo {logo.placement === "INNE" ? "(gdzie dokładnie?)" : "(opcjonalnie)"}
      </label>
      <input
        id={descriptionId}
        value={logo.description}
        onChange={(event) => onChange({ description: event.target.value })}
        maxLength={1000}
        className="input text-base"
        placeholder="np. logo firmy 8 cm, napis „Przedszkole nr 4” pod kołnierzem"
      />

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-muted">Zdjęcie logo (wzór)</p>
        <OrderPhotos
          value={logo.photos}
          onChange={(update) => onPhotos(update)}
          max={ORDER_MAX_LOGO_PHOTOS}
          noun="zdjęcie logo"
          hint="Zdjęcie albo zrzut ekranu wzoru tego logo."
        />
      </div>

      {messages.map((message) => (
        <p key={message} className="field-error text-sm">
          {message}
        </p>
      ))}
    </li>
  );
}

/**
 * Formularz zlecenia (klient) albo szablonu zlecenia (pracownik, na karcie
 * klienta): najpierw asortyment, potem dowolnie wiele logo — każde z rodzajem
 * (haft/DTF), miejscem i opisem. Szablon ma nazwę i nie ma ilości — ilość
 * klient poda przy zamówieniu.
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
  const [logos, setLogos] = useState<LogoDraft[]>(() =>
    defaults && defaults.logos.length > 0 ? defaults.logos.map(toDraft) : [emptyLogo(0)],
  );
  const errors = state?.errors;

  function updateLogo(key: number, patch: Partial<LogoDraft>) {
    setLogos((current) => current.map((logo) => (logo.key === key ? { ...logo, ...patch } : logo)));
  }

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
        <h2 className="mb-3 text-lg font-semibold">1. Asortyment</h2>
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
          <p className="mb-2 text-sm font-medium text-muted">Zdjęcie asortymentu</p>
          <OrderPhotos
            value={photos}
            onChange={setPhotos}
            hint="Zdjęcie samej odzieży (np. koszulki, czapki). Można zrobić je telefonem — zostanie zmniejszone automatycznie."
          />
          <input type="hidden" name="photos" value={JSON.stringify(photos)} />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold">2. Logo na asortymencie</h2>
        <p className="mb-4 text-sm text-muted">
          Dla każdego logo wybierz rodzaj (haft albo DTF) i miejsce. Kolejne logo dodasz przyciskiem poniżej.
        </p>

        <ol className="space-y-4">
          {logos.map((logo, index) => (
            <LogoCard
              key={logo.key}
              logo={logo}
              index={index}
              canRemove={logos.length > 1}
              errors={errors}
              onChange={(patch) => updateLogo(logo.key, patch)}
              onPhotos={(update) =>
                setLogos((current) =>
                  current.map((item) => (item.key === logo.key ? { ...item, photos: update(item.photos) } : item)),
                )
              }
              onRemove={() => setLogos((current) => current.filter((item) => item.key !== logo.key))}
            />
          ))}
        </ol>
        <input type="hidden" name="logos" value={serializeLogos(logos)} />
        <Errors errors={errors} name="logos" />

        {logos.length < ORDER_MAX_LOGOS ? (
          <button
            type="button"
            onClick={() => setLogos((current) => [...current, emptyLogo(nextKey(current))])}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-line px-4 py-4 text-lg font-medium text-accent hover:border-accent/50 hover:bg-accent-soft"
          >
            + Dodaj kolejne logo
          </button>
        ) : null}
      </section>

      <section className="card p-5 sm:p-6">
        {template ? null : (
          <>
            <h2 className="mb-3 text-lg font-semibold">3. Ilość</h2>
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
          {template ? "3. Opis" : "Uwagi (opcjonalnie)"}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.notes}
          className="input text-base"
          placeholder={template ? "np. kolory nici, plik z projektem u nas" : "np. termin, kolory nici, rozmiary"}
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
