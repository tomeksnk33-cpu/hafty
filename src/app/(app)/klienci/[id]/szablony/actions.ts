"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readTemplateForm, removeUnusedOrderFiles } from "@/lib/orders-server";
import { toFormState, type FormState } from "@/lib/validation";

function refresh(clientId: string) {
  revalidatePath(`/klienci/${clientId}`);
  revalidatePath("/moje-zlecenia");
  revalidatePath("/moje-zlecenia/nowe");
}

/** Nowy szablon zlecenia dla klienta — przygotowuje go pracownik na karcie klienta. */
export async function createTemplate(
  clientId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const { parsed, photos } = readTemplateForm(formData);

  if (!parsed.success) return toFormState(parsed.error);

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { message: "Ten klient już nie istnieje." };

  await prisma.orderTemplate.create({
    data: {
      ...parsed.data,
      clientId,
      photos: { create: photos.map((photo, position) => ({ ...photo, position })) },
    },
  });

  refresh(clientId);
  redirect(`/klienci/${clientId}#szablony`);
}

export async function updateTemplate(
  clientId: string,
  templateId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const { parsed, photos } = readTemplateForm(formData);

  if (!parsed.success) return toFormState(parsed.error);

  const template = await prisma.orderTemplate.findFirst({
    where: { id: templateId, clientId },
    select: { photos: { select: { url: true, pathname: true } } },
  });

  if (!template) return { message: "Ten szablon już nie istnieje." };

  await prisma.$transaction([
    prisma.orderTemplatePhoto.deleteMany({ where: { templateId } }),
    prisma.orderTemplate.update({
      where: { id: templateId },
      data: {
        ...parsed.data,
        photos: { create: photos.map((photo, position) => ({ ...photo, position })) },
      },
    }),
  ]);

  // Zdjęcia usunięte z szablonu — chyba że używa ich któreś zlecenie.
  await removeUnusedOrderFiles(template.photos);

  refresh(clientId);
  redirect(`/klienci/${clientId}#szablony`);
}

/** Usuwa szablon. Złożone z niego zlecenia zostają razem ze zdjęciami. */
export async function deleteTemplate(clientId: string, templateId: string) {
  await requireManager();

  const photos = await prisma.orderTemplatePhoto.findMany({
    where: { templateId, template: { clientId } },
    select: { url: true, pathname: true },
  });

  await prisma.orderTemplate.deleteMany({ where: { id: templateId, clientId } });
  await removeUnusedOrderFiles(photos);

  refresh(clientId);
  redirect(`/klienci/${clientId}#szablony`);
}
