"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import {
  fieldValue,
  toFormState,
  userCreateSchema,
  userUpdateSchema,
  type FormState,
} from "@/lib/validation";

const LOGIN_TAKEN: FormState = {
  message: "Taki login już istnieje.",
  errors: { login: ["Ten login jest już zajęty"] },
};

function isDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Pola przychodzą jako tekst, a pola wyboru jako "on" albo wcale. Zaznaczone
 * i wyszarzone pole nie jest wysyłane przez przeglądarkę, więc administrator
 * zawsze dostaje `false` — uprawnienia wynikają u niego z samej roli.
 */
function readForm(formData: FormData) {
  return {
    name: fieldValue(formData, "name"),
    login: fieldValue(formData, "login"),
    password: fieldValue(formData, "password"),
    role: fieldValue(formData, "role"),
    canManageRealizations: formData.get("canManageRealizations") === "on",
    canUseEmbroidery: formData.get("canUseEmbroidery") === "on",
    canUseLaundry: formData.get("canUseLaundry") === "on",
    active: formData.get("active") === "on",
  };
}

/** Pracownik musi mieć dostęp przynajmniej do jednej aplikacji. Administrator ma zawsze do obu. */
function accessProblem(data: { role: Role; canUseEmbroidery: boolean; canUseLaundry: boolean }): FormState | null {
  if (data.role === Role.ADMIN || data.canUseEmbroidery || data.canUseLaundry) return null;

  const message = "Zaznacz przynajmniej jedną aplikację, z której ta osoba może korzystać.";

  return { message, errors: { access: [message] } };
}

export async function createUser(_state: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = userCreateSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const { password, ...data } = parsed.data;

  const noAccess = accessProblem(data);
  if (noAccess) return noAccess;

  try {
    await prisma.user.create({ data: { ...data, passwordHash: hashPassword(password) } });
  } catch (error) {
    if (isDuplicate(error)) return LOGIN_TAKEN;
    throw error;
  }

  revalidatePath("/pracownicy");
  revalidatePath("/rozliczenia");

  redirect("/pracownicy");
}

export async function updateUser(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = userUpdateSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const { password, ...data } = parsed.data;

  const noAccess = accessProblem(data);
  if (noAccess) return noAccess;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });

  if (!target) return { message: "Ta osoba już nie istnieje." };

  // Puste pole oznacza "bez zmiany hasła" — ale jeśli coś wpisano, ma spełniać zasady.
  if (password !== "") {
    const problem = passwordProblem(password);
    if (problem) return { message: problem, errors: { password: [problem] } };
  }

  // Zalogowany administrator jest zawsze aktywny, więc dopóki nie odbierze sobie
  // uprawnień sam, zawsze zostaje w systemie ktoś, kto może zarządzać kontami.
  if (target.id === admin.id && (data.role !== Role.ADMIN || !data.active)) {
    return {
      message:
        "Nie możesz odebrać sobie uprawnień administratora ani wyłączyć własnego konta. Zrobi to inny administrator.",
    };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { ...data, ...(password !== "" ? { passwordHash: hashPassword(password) } : {}) },
    });
  } catch (error) {
    if (isDuplicate(error)) return LOGIN_TAKEN;
    throw error;
  }

  revalidatePath("/pracownicy");
  revalidatePath("/rozliczenia");

  redirect("/pracownicy");
}
