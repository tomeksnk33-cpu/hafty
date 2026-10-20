"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { MarkerInput } from "@/lib/markers";
import { removeFiles } from "@/lib/storage";
import {
  fieldValue,
  markerSchema,
  realizationSchema,
  toFormState,
  type FormState,
} from "@/lib/validation";

const uploadedFileSchema = z.object({
  url: z.string().min(1).max(2000),
  pathname: z.string().min(1).max(500),
  filename: z.string().min(1).max(300),
  sizeBytes: z.number().int().min(0),
});

/**
 * Pola z uploaderów przychodzą jako JSON w ukrytym inpucie. Zły JSON
 * traktujemy jak brak plików — formularz i tak pokaże błędy walidacji reszty.
 */
function readUploads(formData: FormData, name: string) {
  const raw = fieldValue(formData, name);
  if (raw === "") return [];

  try {
    const parsed = z.array(uploadedFileSchema).max(50).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function readMarkers(formData: FormData): MarkerInput[] {
  const raw = fieldValue(formData, "markers");
  if (raw === "") return [];

  try {
    const parsed = z.array(markerSchema).max(500).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function readForm(formData: FormData) {
  return realizationSchema.safeParse({
    name: fieldValue(formData, "name"),
    executedAt: fieldValue(formData, "executedAt"),
    clientId: fieldValue(formData, "clientId"),
    productType: fieldValue(formData, "productType"),
    widthMm: fieldValue(formData, "widthMm"),
    heightMm: fieldValue(formData, "heightMm"),
    stitchCount: fieldValue(formData, "stitchCount"),
    quantity: fieldValue(formData, "quantity"),
    unitPriceGr: fieldValue(formData, "unitPriceGr"),
    notes: fieldValue(formData, "notes"),
    threadIds: formData.getAll("threadIds").filter((v) => typeof v === "string"),
  });
}

/**
 * Odsiewa identyfikatory, których już nie ma w bazie (np. usunięte w innej
 * karcie). Zachowuje kolejność wyboru z formularza — z niej biorą się numery
 * nici pokazywane na znacznikach, więc nie może jej ustalać baza.
 */
async function existingThreadIds(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const rows = await prisma.thread.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });

  const found = new Set(rows.map((row) => row.id));

  return unique.filter((id) => found.has(id));
}

/**
 * Zapisuje znaczniki po utworzeniu zdjęć — dopiero wtedy znamy ich id.
 * Znaczniki wskazujące na nieistniejące zdjęcie lub odpiętą nić pomijamy.
 */
async function saveMarkers(
  realizationId: string,
  markers: MarkerInput[],
  threadIds: string[],
) {
  if (markers.length === 0) return;

  const photos = await prisma.photo.findMany({
    where: { realizationId },
    select: { id: true, pathname: true },
  });

  const photoIdByPathname = new Map(photos.map((photo) => [photo.pathname, photo.id]));
  const allowedThreads = new Set(threadIds);

  const rows = markers.flatMap((marker) => {
    const photoId = photoIdByPathname.get(marker.photo);

    if (!photoId || !allowedThreads.has(marker.thread)) return [];

    return [{ photoId, threadId: marker.thread, x: marker.x, y: marker.y }];
  });

  if (rows.length > 0) {
    await prisma.threadMarker.createMany({ data: rows });
  }
}

async function existingClientId(id: string | null) {
  if (!id) return null;

  const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  return client?.id ?? null;
}

function revalidateEverywhere(id?: string) {
  revalidatePath("/");
  revalidatePath("/realizacje");
  revalidatePath("/klienci");
  revalidatePath("/nici");
  if (id) revalidatePath(`/realizacje/${id}`);
}

export async function createRealization(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // Akcje serwerowe to publiczne endpointy — uprawnienia sprawdzamy tu, a nie
  // tylko przez ukrycie przycisku w interfejsie.
  const user = await requireManager();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const { threadIds, clientId, unitPriceGr, ...fields } = parsed.data;
  const photos = readUploads(formData, "photos");
  const designFiles = readUploads(formData, "designFiles");
  const markers = readMarkers(formData);

  const [validClientId, validThreadIds] = await Promise.all([
    existingClientId(clientId),
    existingThreadIds(threadIds),
  ]);

  const realization = await prisma.realization.create({
    data: {
      ...fields,
      // Ceny ustala tylko administrator, także gdy ktoś dośle pole ręcznie.
      unitPriceGr: user.canSeeMoney ? unitPriceGr : null,
      clientId: validClientId,
      photos: {
        create: photos.map((photo, index) => ({
          url: photo.url,
          pathname: photo.pathname,
          position: index,
        })),
      },
      designFiles: {
        create: designFiles.map((file) => ({
          url: file.url,
          pathname: file.pathname,
          filename: file.filename,
          sizeBytes: file.sizeBytes,
        })),
      },
      threads: {
        create: validThreadIds.map((threadId, index) => ({ threadId, position: index })),
      },
    },
    select: { id: true },
  });

  await saveMarkers(realization.id, markers, validThreadIds);

  revalidateEverywhere(realization.id);

  redirect(`/realizacje/${realization.id}`);
}

export async function updateRealization(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireManager();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const { threadIds, clientId, unitPriceGr, ...fields } = parsed.data;
  const photos = readUploads(formData, "photos");
  const designFiles = readUploads(formData, "designFiles");
  const markers = readMarkers(formData);

  const before = await prisma.realization.findUnique({
    where: { id },
    select: {
      photos: { select: { url: true, pathname: true } },
      designFiles: { select: { url: true, pathname: true } },
    },
  });

  if (!before) {
    return { message: "Ta realizacja już nie istnieje." };
  }

  const keptPathnames = new Set([
    ...photos.map((photo) => photo.pathname),
    ...designFiles.map((file) => file.pathname),
  ]);

  const orphaned = [...before.photos, ...before.designFiles].filter(
    (file) => !keptPathnames.has(file.pathname),
  );

  const [validClientId, validThreadIds] = await Promise.all([
    existingClientId(clientId),
    existingThreadIds(threadIds),
  ]);

  // Zdjęcia, pliki i nici zastępujemy w całości — kolejność zdjęć i skład nici
  // wynikają wprost z tego, co użytkownik widzi w formularzu.
  await prisma.$transaction([
    prisma.photo.deleteMany({ where: { realizationId: id } }),
    prisma.designFile.deleteMany({ where: { realizationId: id } }),
    prisma.realizationThread.deleteMany({ where: { realizationId: id } }),
    prisma.realization.update({
      where: { id },
      data: {
        ...fields,
        // Osoba bez wglądu w ceny nie widzi tego pola w formularzu, więc dostaje
        // pustą wartość — bez tego warunku każda jej edycja kasowałaby cenę.
        ...(user.canSeeMoney ? { unitPriceGr } : {}),
        clientId: validClientId,
        photos: {
          create: photos.map((photo, index) => ({
            url: photo.url,
            pathname: photo.pathname,
            position: index,
          })),
        },
        designFiles: {
          create: designFiles.map((file) => ({
            url: file.url,
            pathname: file.pathname,
            filename: file.filename,
            sizeBytes: file.sizeBytes,
          })),
        },
        threads: {
          create: validThreadIds.map((threadId, index) => ({ threadId, position: index })),
        },
      },
    }),
  ]);

  // Stare znaczniki zniknęły kaskadowo razem ze zdjęciami, więc odtwarzamy je
  // na nowych rekordach — zdjęcia zachowane w formularzu mają ten sam pathname.
  await saveMarkers(id, markers, validThreadIds);

  // Dopiero po udanym zapisie — inaczej nieudana transakcja zostawiłaby
  // rekordy wskazujące na skasowane pliki.
  await removeFiles(orphaned);

  revalidateEverywhere(id);

  redirect(`/realizacje/${id}`);
}

export async function deleteRealization(id: string) {
  await requireManager();

  const realization = await prisma.realization.findUnique({
    where: { id },
    select: {
      photos: { select: { url: true, pathname: true } },
      designFiles: { select: { url: true, pathname: true } },
    },
  });

  if (!realization) redirect("/realizacje");

  // Photo i DesignFile znikają kaskadowo razem z realizacją.
  await prisma.realization.delete({ where: { id } });

  await removeFiles([...realization.photos, ...realization.designFiles]);

  revalidateEverywhere();

  redirect("/realizacje");
}
