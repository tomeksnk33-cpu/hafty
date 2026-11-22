"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/passwords";
import { orderFiles, removeUnusedOrderFiles, templateFiles } from "@/lib/orders-server";
import {
  clientAccountSchema,
  clientSchema,
  fieldValue,
  toFormState,
  type FormState,
} from "@/lib/validation";

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
  // Nazwa konta klienta (widoczna po zalogowaniu) idzie za nazwą klienta.
  await prisma.user.updateMany({ where: { clientId: id }, data: { name: parsed.data.name } });

  revalidatePath("/klienci");
  revalidatePath(`/klienci/${id}`);
  revalidatePath("/realizacje");

  redirect(`/klienci/${id}`);
}

/**
 * Usuwa klienta razem z jego kontem i zleceniami. Realizacje zostają w bazie — relacja ma `onDelete: SetNull`,
 * więc historia haftów nie znika razem z kontaktem.
 */
export async function deleteClient(id: string) {
  await requireManager();

  const [orderPhotos, templatePhotos] = await Promise.all([
    orderFiles({ clientId: id }),
    templateFiles({ clientId: id }),
  ]);

  await prisma.client.delete({ where: { id } });
  await removeUnusedOrderFiles([...orderPhotos, ...templatePhotos]);

  revalidatePath("/klienci");
  revalidatePath("/realizacje");
  revalidatePath("/pulpit");

  redirect("/klienci");
}

/**
 * Zakłada albo zmienia konto, którym klient loguje się, żeby składać zlecenia.
 * Konto klienta ma wyłączone wszystkie aplikacje pracowników — lib/auth.ts
 * i tak traktuje każde konto z `clientId` jako klienta.
 */
export async function saveClientAccount(
  clientId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();

  const parsed = clientAccountSchema.safeParse({
    login: fieldValue(formData, "login"),
    password: fieldValue(formData, "password"),
  });

  if (!parsed.success) return toFormState(parsed.error);

  const { login, password } = parsed.data;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, account: { select: { id: true } } },
  });

  if (!client) return { message: "Ten klient już nie istnieje." };

  // Przy nowym koncie hasło jest wymagane, przy zmianie puste = bez zmiany.
  if (password !== "" || !client.account) {
    const problem = passwordProblem(password);
    if (problem) return { message: problem, errors: { password: [problem] } };
  }

  try {
    if (client.account) {
      await prisma.user.update({
        where: { id: client.account.id },
        data: { login, ...(password !== "" ? { passwordHash: hashPassword(password) } : {}) },
      });
    } else {
      await prisma.user.create({
        data: {
          login,
          name: client.name,
          passwordHash: hashPassword(password),
          role: Role.EMPLOYEE,
          clientId,
          canManageRealizations: false,
          canUseEmbroidery: false,
          canUseLaundry: false,
          isLaundryManager: false,
          isLaundryDriver: false,
          canUseTimeclock: false,
          canUseAttendance: false,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "Taki login już istnieje.", errors: { login: ["Ten login jest już zajęty"] } };
    }
    throw error;
  }

  revalidatePath(`/klienci/${clientId}`);

  return {
    ok: true,
    message: client.account
      ? password !== ""
        ? "Zapisano login i nowe hasło."
        : "Zapisano login."
      : "Konto założone. Przekaż klientowi login i hasło.",
    savedAt: Date.now(),
  };
}

/** Blokuje albo odblokowuje logowanie klienta. Zlecenia zostają. */
export async function setClientAccountActive(clientId: string, active: boolean) {
  await requireManager();

  await prisma.user.updateMany({ where: { clientId }, data: { active } });

  revalidatePath(`/klienci/${clientId}`);
}
