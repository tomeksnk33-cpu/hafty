"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientSchema, fieldValue, toFormState, type FormState } from "@/lib/validation";

function readForm(formData: FormData) {
  return clientSchema.safeParse({
    name: fieldValue(formData, "name"),
    company: fieldValue(formData, "company"),
    phone: fieldValue(formData, "phone"),
    email: fieldValue(formData, "email"),
    notes: fieldValue(formData, "notes"),
  });
}

export async function createClient(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const client = await prisma.client.create({ data: parsed.data });

  revalidatePath("/klienci");
  revalidatePath("/pulpit");

  redirect(`/klienci/${client.id}`);
}

export async function updateClient(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  await prisma.client.update({ where: { id }, data: parsed.data });

  revalidatePath("/klienci");
  revalidatePath(`/klienci/${id}`);
  revalidatePath("/realizacje");

  redirect(`/klienci/${id}`);
}

/**
 * Usuwa klienta. Realizacje zostają w bazie — relacja ma `onDelete: SetNull`,
 * więc historia haftów nie znika razem z kontaktem.
 */
export async function deleteClient(id: string) {
  await requireManager();

  await prisma.client.delete({ where: { id } });

  revalidatePath("/klienci");
  revalidatePath("/realizacje");
  revalidatePath("/pulpit");

  redirect("/klienci");
}
