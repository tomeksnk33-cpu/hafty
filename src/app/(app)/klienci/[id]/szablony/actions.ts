"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { removeTemplate, saveTemplate } from "@/lib/order-templates";
import type { FormState } from "@/lib/validation";

function refresh(clientId: string) {
  revalidatePath(`/klienci/${clientId}`);
  revalidatePath("/moje-zlecenia", "layout");
}

/** Nowy szablon zlecenia dla klienta — przygotowuje go pracownik na karcie klienta. */
export async function createTemplate(
  clientId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();

  const problem = await saveTemplate(clientId, null, formData);
  if (problem) return problem;

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

  const problem = await saveTemplate(clientId, templateId, formData);
  if (problem) return problem;

  refresh(clientId);
  redirect(`/klienci/${clientId}#szablony`);
}

export async function deleteTemplate(clientId: string, templateId: string) {
  await requireManager();

  await removeTemplate(clientId, templateId);

  refresh(clientId);
  redirect(`/klienci/${clientId}#szablony`);
}
