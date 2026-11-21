"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyNewOrder, readOrderForm } from "@/lib/orders-server";
import { orderQuantitySchema, toFormState, type FormState } from "@/lib/validation";

async function requestOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

/** Klient składa zlecenie — zawsze na siebie, id klienta bierzemy z sesji, nie z formularza. */
export async function createOwnOrder(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireClient();
  const { parsed, photos } = readOrderForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const order = await prisma.embroideryOrder.create({
    data: {
      ...parsed.data,
      clientId: user.clientId,
      createdById: user.id,
      photos: {
        create: photos.map((photo, position) => ({ ...photo, position })),
      },
    },
    select: { id: true },
  });

  const origin = await requestOrigin();
  after(() => notifyNewOrder(order.id, origin));

  revalidatePath("/moje-zlecenia");
  revalidatePath("/zlecenia");

  redirect(`/moje-zlecenia/${order.id}?wyslane=1`);
}

/**
 * Zlecenie z szablonu: klient podaje tylko ilość, resztę (razem ze zdjęciami)
 * kopiujemy z szablonu w chwili zamówienia — późniejsza zmiana szablonu nie
 * zmienia złożonych zleceń. Pliki zdjęć są wspólne (removeUnusedOrderFiles).
 */
export async function createOrderFromTemplate(
  templateId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireClient();
  const quantity = orderQuantitySchema.safeParse(String(formData.get("quantity") ?? ""));

  if (!quantity.success) {
    return { message: "Podaj ilość.", errors: { quantity: quantity.error.issues.map((issue) => issue.message) } };
  }

  const template = await prisma.orderTemplate.findFirst({
    where: { id: templateId, clientId: user.clientId },
    include: { photos: { orderBy: { position: "asc" } } },
  });

  if (!template) return { message: "Ten szablon już nie istnieje. Odśwież stronę." };

  const order = await prisma.embroideryOrder.create({
    data: {
      clientId: user.clientId,
      createdById: user.id,
      templateId: template.id,
      kind: template.kind,
      product: template.product,
      placements: template.placements,
      placementNotes: template.placementNotes,
      notes: template.notes,
      quantity: quantity.data,
      photos: {
        create: template.photos.map(({ url, pathname, filename, sizeBytes }, position) => ({
          url,
          pathname,
          filename,
          sizeBytes,
          position,
        })),
      },
    },
    select: { id: true },
  });

  const origin = await requestOrigin();
  after(() => notifyNewOrder(order.id, origin));

  revalidatePath("/moje-zlecenia");
  revalidatePath("/zlecenia");

  redirect(`/moje-zlecenia/${order.id}?wyslane=1`);
}

/** Klient może wycofać zlecenie, dopóki nikt go nie zaczął realizować. */
export async function cancelOwnOrder(id: string) {
  const user = await requireClient();

  await prisma.embroideryOrder.updateMany({
    where: { id, clientId: user.clientId, status: "NOWE" },
    data: { status: "ANULOWANE" },
  });

  revalidatePath("/moje-zlecenia");
  revalidatePath(`/moje-zlecenia/${id}`);
  revalidatePath("/zlecenia");
}
