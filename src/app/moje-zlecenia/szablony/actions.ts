"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireClient } from "@/lib/auth";
import { removeTemplate, saveTemplate, templateFromOrder } from "@/lib/order-templates";
import type { FormState } from "@/lib/validation";

// Klient zarządza tylko szablonami swojego klienta — id klienta zawsze z sesji.

function refresh(clientId: string) {
  revalidatePath("/moje-zlecenia", "layout");
  revalidatePath(`/klienci/${clientId}`);
}

export async function createOwnTemplate(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireClient();

  const problem = await saveTemplate(user.clientId, null, formData);
  if (problem) return problem;

  refresh(user.clientId);
  redirect("/moje-zlecenia/szablony?zapisano=1");
}

export async function updateOwnTemplate(
  templateId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireClient();

  const problem = await saveTemplate(user.clientId, templateId, formData);
  if (problem) return problem;

  refresh(user.clientId);
  redirect("/moje-zlecenia/szablony?zapisano=1");
}

export async function deleteOwnTemplate(templateId: string) {
  const user = await requireClient();

  await removeTemplate(user.clientId, templateId);

  refresh(user.clientId);
  redirect("/moje-zlecenia/szablony");
}

/** „Zapisz jako szablon" przy złożonym zleceniu — potem klient może poprawić nazwę. */
export async function saveOrderAsTemplate(orderId: string) {
  const user = await requireClient();

  const templateId = await templateFromOrder(user.clientId, orderId);
  if (!templateId) redirect("/moje-zlecenia");

  refresh(user.clientId);
  redirect(`/moje-zlecenia/szablony/${templateId}?zlecenia=1`);
}
