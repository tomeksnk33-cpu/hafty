"use client";

import Image from "next/image";
import { useId, useState } from "react";

import { formatFileSize } from "@/lib/format";
import { resizeImage } from "@/lib/resize-image";
import { checkFile, DESIGN_ACCEPT, type UploadedFile, type UploadKind } from "@/lib/uploads";

async function uploadOne(kind: UploadKind, file: File): Promise<UploadedFile> {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);

  const response = await fetch("/api/pliki", { method: "POST", body });
  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : "Nie udało się wysłać pliku.";

    throw new Error(message);
  }

  return data as UploadedFile;
}

/** Wspólna obsługa wyboru plików: walidacja, wysyłka, komunikat błędu. */
function useUploader(kind: UploadKind, onAdd: (files: UploadedFile[]) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setBusy(true);
    setError(null);

    const uploaded: UploadedFile[] = [];
    const problems: string[] = [];

    for (const original of Array.from(fileList)) {
      const file = kind === "zdjecia" ? await resizeImage(original) : original;
      const problem = checkFile(kind, file);

      if (problem) {
        problems.push(problem);
        continue;
      }

      try {
        uploaded.push(await uploadOne(kind, file));
      } catch (uploadError) {
        problems.push(
          uploadError instanceof Error ? uploadError.message : `Nie wysłano „${file.name}”.`,
        );
      }
    }

    if (uploaded.length > 0) onAdd(uploaded);
    if (problems.length > 0) setError(problems.join(" "));

    setBusy(false);
  }

  return { busy, error, handleFiles };
}

/**
 * Komponent sterowany — stan zdjęć trzyma formularz, bo potrzebuje go także
 * edytor znaczników nici. `onChange` przyjmuje aktualizację funkcyjną, żeby
 * dwie zmiany w tym samym cyklu renderowania nie nadpisywały się nawzajem.
 */
export function PhotoUploader({
  value,
  onChange,
}: {
  value: UploadedFile[];
  onChange: (update: (current: UploadedFile[]) => UploadedFile[]) => void;
}) {
  const inputId = useId();

  const { busy, error, handleFiles } = useUploader("zdjecia", (added) =>
    onChange((current) => [...current, ...added]),
  );

  function move(index: number, direction: -1 | 1) {
    onChange((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div>
      {value.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((photo, index) => (
            <li key={photo.pathname} className="card overflow-hidden">
              <div className="relative aspect-square bg-paper">
                <Image src={photo.url} alt="" fill sizes="200px" className="object-cover" />
                {index === 0 ? (
                  <span className="absolute top-1 left-1 rounded bg-ink/75 px-1.5 py-0.5 text-[10px] text-white">
                    okładka
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Przesuń w lewo"
                    className="rounded px-1.5 text-muted hover:text-ink disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label="Przesuń w prawo"
                    className="rounded px-1.5 text-muted hover:text-ink disabled:opacity-30"
                  >
                    →
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onChange((current) => current.filter((_, i) => i !== index))
                  }
                  className="px-1 text-xs text-accent hover:underline"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <label htmlFor={inputId} className="btn-secondary cursor-pointer" aria-disabled={busy}>
        {busy ? "Wysyłam…" : value.length > 0 ? "Dodaj kolejne zdjęcia" : "Wybierz zdjęcia"}
      </label>

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
        Zdjęcia są automatycznie zmniejszane do 2000 px, więc można wgrywać prosto z telefonu.
      </p>

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export function DesignFileUploader({
  value,
  onChange,
}: {
  value: UploadedFile[];
  onChange: (update: (current: UploadedFile[]) => UploadedFile[]) => void;
}) {
  const inputId = useId();

  const { busy, error, handleFiles } = useUploader("projekty", (added) =>
    onChange((current) => [...current, ...added]),
  );

  return (
    <div>
      {value.length > 0 ? (
        <ul className="card mb-3 divide-y divide-line">
          {value.map((file, index) => (
            <li key={file.pathname} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{file.filename}</span>
              <span className="shrink-0 text-xs text-muted">
                {formatFileSize(file.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => onChange((current) => current.filter((_, i) => i !== index))}
                className="shrink-0 text-xs text-accent hover:underline"
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label htmlFor={inputId} className="btn-secondary cursor-pointer" aria-disabled={busy}>
        {busy ? "Wysyłam…" : value.length > 0 ? "Dodaj kolejny plik" : "Wybierz plik projektu"}
      </label>

      <input
        id={inputId}
        type="file"
        accept={DESIGN_ACCEPT}
        multiple
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <p className="field-hint">Obsługiwane: {DESIGN_ACCEPT}. Limit 4 MB na plik.</p>

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
