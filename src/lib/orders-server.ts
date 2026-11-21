import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/mail";
import {
  ORDER_KIND_LABEL,
  ORDER_MAX_PHOTOS,
  ORDER_PHOTO_FOLDER,
  orderNumber,
  placementText,
} from "@/lib/orders";
import { removeFiles, type StoredFile } from "@/lib/storage";
import { fieldValue, orderSchema, orderTemplateSchema } from "@/lib/validation";

const uploadedPhotoSchema = z.object({
  url: z.string().min(1).max(2000),
  pathname: z.string().min(1).max(500),
  filename: z.string().min(1).max(300),
  sizeBytes: z.number().int().min(0),
});

/**
 * Zdjęcie musi pochodzić z naszego uploadu zdjęć zleceń: ścieżka w folderze
 * zleceń, a adres to Vercel Blob albo lokalny katalog uploads. Bez tego klient
 * mógłby podpiąć pod zlecenie dowolny adres (albo cudzy plik z realizacji).
 */
function isOrderUpload(photo: { url: string; pathname: string }) {
  if (!photo.pathname.startsWith(`${ORDER_PHOTO_FOLDER}/`) || photo.pathname.includes("..")) {
    return false;
  }

  if (photo.url === `/uploads/${photo.pathname}`) return true;

  try {
    const url = new URL(photo.url);

    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      url.pathname === `/${photo.pathname}`
    );
  } catch {
    return false;
  }
}

function readPhotos(formData: FormData) {
  const raw = fieldValue(formData, "photos");
  if (raw === "") return [];

  try {
    const parsed = z.array(uploadedPhotoSchema).max(ORDER_MAX_PHOTOS).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.filter(isOrderUpload) : [];
  } catch {
    return [];
  }
}

export function readTemplateForm(formData: FormData) {
  return {
    parsed: orderTemplateSchema.safeParse({
      name: fieldValue(formData, "name"),
      kind: fieldValue(formData, "kind"),
      product: fieldValue(formData, "product"),
      placements: formData.getAll("placements").filter((v) => typeof v === "string"),
      placementNotes: fieldValue(formData, "placementNotes"),
      notes: fieldValue(formData, "notes"),
    }),
    photos: readPhotos(formData),
  };
}

/**
 * Zlecenia złożone z szablonu używają tych samych plików co szablon. Plik
 * kasujemy dopiero, gdy nie wskazuje na niego już żadne zlecenie ani szablon.
 * Wołać po usunięciu rekordów z bazy.
 */
export async function removeUnusedOrderFiles(files: StoredFile[]) {
  if (files.length === 0) return;

  const pathnames = [...new Set(files.map((file) => file.pathname))];
  const [inOrders, inTemplates] = await Promise.all([
    prisma.orderPhoto.findMany({ where: { pathname: { in: pathnames } }, select: { pathname: true } }),
    prisma.orderTemplatePhoto.findMany({ where: { pathname: { in: pathnames } }, select: { pathname: true } }),
  ]);
  const used = new Set([...inOrders, ...inTemplates].map((row) => row.pathname));
  const seen = new Set<string>();

  await removeFiles(
    files.filter((file) => {
      if (used.has(file.pathname) || seen.has(file.pathname)) return false;
      seen.add(file.pathname);
      return true;
    }),
  );
}

export function readOrderForm(formData: FormData) {
  return {
    parsed: orderSchema.safeParse({
      kind: fieldValue(formData, "kind"),
      product: fieldValue(formData, "product"),
      placements: formData.getAll("placements").filter((v) => typeof v === "string"),
      placementNotes: fieldValue(formData, "placementNotes"),
      quantity: fieldValue(formData, "quantity"),
      notes: fieldValue(formData, "notes"),
    }),
    photos: readPhotos(formData),
  };
}

/** Mail do biura o nowym zleceniu. Błąd poczty nie cofa zapisanego zlecenia. */
export async function notifyNewOrder(orderId: string, origin: string) {
  if (!mailConfigured()) return;

  const order = await prisma.embroideryOrder.findUnique({
    where: { id: orderId },
    include: { client: { select: { name: true, company: true } }, photos: true },
  });

  if (!order) return;

  const who = [order.client.name, order.client.company].filter(Boolean).join(" · ");
  const rows: [string, string][] = [
    ["Klient", who],
    ["Rodzaj", ORDER_KIND_LABEL[order.kind]],
    ["Asortyment", order.product],
    ["Umiejscowienie", placementText(order.placements, order.placementNotes)],
    ["Ilość", `${order.quantity} szt.`],
    ["Uwagi", order.notes ?? "—"],
  ];
  const link = `${origin}/zlecenia/${order.id}`;
  const photoUrls = order.photos.map((photo) =>
    photo.url.startsWith("/") ? `${origin}${photo.url}` : photo.url,
  );
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const text = [
    `Nowe zlecenie ${orderNumber(order.number)}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    photoUrls.length > 0 ? `Zdjęcia:\n${photoUrls.join("\n")}` : "Bez zdjęć.",
    "",
    `Szczegóły: ${link}`,
  ].join("\n");

  const html = `<h2>Nowe zlecenie ${orderNumber(order.number)}</h2>
<table cellpadding="4">${rows
    .map(([label, value]) => `<tr><td><b>${escape(label)}</b></td><td>${escape(value)}</td></tr>`)
    .join("")}</table>
${photoUrls.map((url) => `<p><a href="${escape(url)}"><img src="${escape(url)}" alt="" style="max-width:320px"></a></p>`).join("")}
<p><a href="${escape(link)}">Otwórz zlecenie w bazie haftów</a></p>`;

  try {
    await sendMail({ subject: `Nowe zlecenie ${orderNumber(order.number)} — ${order.client.name}`, text, html });
  } catch (error) {
    console.error("Nie wysłano maila o nowym zleceniu:", error);
  }
}
