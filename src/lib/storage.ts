import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { del, put } from "@vercel/blob";

export type StoredFile = {
  url: string;
  pathname: string;
};

/**
 * Na produkcji pliki idą do Vercel Blob. Lokalnie, gdy nie ma tokenu, lądują
 * w `public/uploads`, dzięki czemu całą aplikację można przetestować bez konta
 * w chmurze. Cała różnica jest zamknięta w tym module.
 */
function usingBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Zostawia tylko bezpieczne znaki, zachowując rozszerzenie pliku. */
function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-80);

  return cleaned || "plik";
}

export async function saveFile(folder: string, file: File): Promise<StoredFile> {
  const pathname = `${folder}/${randomUUID()}-${safeFileName(file.name)}`;

  if (usingBlob()) {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || undefined,
    });

    return { url: blob.url, pathname: blob.pathname };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Brak BLOB_READ_WRITE_TOKEN. Na produkcji podłącz Vercel Blob do projektu — " +
        "zapis na dysk serwera nie zadziała, bo system plików jest tylko do odczytu.",
    );
  }

  const target = path.join(process.cwd(), "public", "uploads", pathname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  return { url: `/uploads/${pathname}`, pathname };
}

/**
 * Kasuje pliki osierocone po usunięciu rekordu. Nie przerywa operacji przy
 * błędzie — rekord w bazie już zniknął, a nieusunięty plik to najwyżej
 * zajęte miejsce, nie utrata danych.
 */
export async function removeFiles(files: StoredFile[]) {
  if (files.length === 0) return;

  try {
    if (usingBlob()) {
      await del(files.map((file) => file.url));
      return;
    }

    await Promise.all(
      files.map((file) =>
        unlink(path.join(process.cwd(), "public", "uploads", file.pathname)).catch(
          () => undefined,
        ),
      ),
    );
  } catch (error) {
    console.error("Nie udało się usunąć plików z magazynu:", error);
  }
}
