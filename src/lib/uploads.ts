/** Wspólne reguły uploadu — używane i przez przeglądarkę, i przez serwer. */

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const DESIGN_MAX_BYTES = 4 * 1024 * 1024;

/** Rozszerzenia plików maszynowych do haftu + PDF na podglądy/wykroje. */
export const DESIGN_EXTENSIONS = [
  ".dst",
  ".pes",
  ".exp",
  ".jef",
  ".vp3",
  ".emb",
  ".hus",
  ".xxx",
  ".pdf",
] as const;

export const DESIGN_ACCEPT = DESIGN_EXTENSIONS.join(",");

export type UploadKind = "zdjecia" | "projekty";

export type UploadedFile = {
  url: string;
  pathname: string;
  filename: string;
  sizeBytes: number;
};

export function hasDesignExtension(filename: string) {
  const lower = filename.toLowerCase();
  return DESIGN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Zwraca komunikat błędu albo `null`, gdy plik jest w porządku. */
export function checkFile(kind: UploadKind, file: { name: string; type: string; size: number }) {
  if (kind === "zdjecia") {
    if (!file.type.startsWith("image/")) {
      return `„${file.name}” to nie jest zdjęcie.`;
    }

    if (file.size > PHOTO_MAX_BYTES) {
      return `„${file.name}” jest za duże nawet po zmniejszeniu (limit 4 MB).`;
    }

    return null;
  }

  if (!hasDesignExtension(file.name)) {
    return `„${file.name}” ma nieobsługiwane rozszerzenie. Dozwolone: ${DESIGN_ACCEPT}`;
  }

  if (file.size > DESIGN_MAX_BYTES) {
    return `„${file.name}” przekracza limit 4 MB.`;
  }

  return null;
}
