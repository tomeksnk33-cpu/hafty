import "server-only";

import { prisma } from "@/lib/db";
import { logoRows, readTemplateForm, removeUnusedOrderFiles } from "@/lib/orders-server";
import { toFormState, type FormState } from "@/lib/validation";

/**
 * Zapis szablonu zlecenia dla klienta — wspólny dla pracownika (karta klienta)
 * i samego klienta (/moje-zlecenia/szablony). `clientId` zawsze pochodzi
 * z miejsca, które sprawdziło uprawnienia, nie z formularza.
 * Zwraca `null` po udanym zapisie albo stan formularza z błędami.
 */
export async function saveTemplate(
  clientId: string,
  templateId: string | null,
  formData: FormData,
): Promise<FormState> {
  const { parsed, photos } = readTemplateForm(formData);

  if (!parsed.success) return toFormState(parsed.error);

  const { logos, ...fields } = parsed.data;
  const photoRows = photos.map((photo, position) => ({ ...photo, position }));

  if (!templateId) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { message: "Ten klient już nie istnieje." };

    await prisma.orderTemplate.create({
      data: { ...fields, clientId, logos: { create: logoRows(logos) }, photos: { create: photoRows } },
    });

    return null;
  }

  const template = await prisma.orderTemplate.findFirst({
    where: { id: templateId, clientId },
    select: { photos: { select: { url: true, pathname: true } } },
  });

  if (!template) return { message: "Ten szablon już nie istnieje." };

  await prisma.$transaction([
    prisma.orderTemplatePhoto.deleteMany({ where: { templateId } }),
    prisma.orderTemplateLogo.deleteMany({ where: { templateId } }),
    prisma.orderTemplate.update({
      where: { id: templateId },
      data: { ...fields, logos: { create: logoRows(logos) }, photos: { create: photoRows } },
    }),
  ]);

  // Zdjęcia usunięte z szablonu — chyba że używa ich któreś zlecenie.
  await removeUnusedOrderFiles(template.photos);

  return null;
}

/** Usuwa szablon klienta. Złożone z niego zlecenia zostają razem ze zdjęciami. */
export async function removeTemplate(clientId: string, templateId: string) {
  const photos = await prisma.orderTemplatePhoto.findMany({
    where: { templateId, template: { clientId } },
    select: { url: true, pathname: true },
  });

  await prisma.orderTemplate.deleteMany({ where: { id: templateId, clientId } });
  await removeUnusedOrderFiles(photos);
}

/**
 * Nowy szablon ze złożonego zlecenia (asortyment, zdjęcia, logo, uwagi).
 * Zwraca id szablonu albo `null`, gdy zlecenie nie należy do klienta.
 */
export async function templateFromOrder(clientId: string, orderId: string) {
  const order = await prisma.embroideryOrder.findFirst({
    where: { id: orderId, clientId },
    include: {
      photos: { orderBy: { position: "asc" } },
      logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
    },
  });

  if (!order) return null;

  const template = await prisma.orderTemplate.create({
    data: {
      clientId,
      name: order.product.slice(0, 100),
      product: order.product,
      notes: order.notes,
      logos: { create: logoRows(order.logos) },
      photos: {
        create: order.photos.map(({ url, pathname, filename, sizeBytes }, position) => ({
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

  return template.id;
}
