"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInputValue } from "@/lib/format";
import { fieldValue, toFormState, workEntrySchema, type FormState } from "@/lib/validation";
import {
  canChangeEntryOn,
  EDIT_WINDOW_DAYS,
  oldestEditableDate,
  safeReturnPath,
} from "@/lib/work-entries";

function readForm(formData: FormData) {
  return workEntrySchema.safeParse({
    workDate: fieldValue(formData, "workDate"),
    realizationId: fieldValue(formData, "realizationId"),
    quantity: fieldValue(formData, "quantity"),
    notes: fieldValue(formData, "notes"),
  });
}

function toUtcDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dateOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Reguły dla daty wpisu. Zwraca komunikat błędu albo `null`. Egzekwowane po
 * stronie serwera — atrybuty `min`/`max` w formularzu to tylko podpowiedź.
 */
function dateProblem(user: SessionUser, workDate: string) {
  if (toUtcDate(workDate).toISOString().slice(0, 10) !== workDate) {
    return "Taka data nie istnieje.";
  }

  const today = todayInputValue();

  if (workDate > today) return "Data wpisu nie może być z przyszłości.";

  if (!user.isAdmin && workDate < oldestEditableDate(today)) {
    return `Możesz wpisywać i poprawiać tylko ostatnie ${EDIT_WINDOW_DAYS} dni. Starszy wpis doda administrator.`;
  }

  return null;
}

function fieldError(field: string, message: string): FormState {
  // Szczegół pokazujemy przy polu, a baner zostaje ogólny — tak samo jak w
  // pozostałych formularzach (toFormState).
  return { message: "Popraw zaznaczone pola.", errors: { [field]: [message] } };
}

function revalidateEntries() {
  revalidatePath("/");
  revalidatePath("/dziennik");
  revalidatePath("/rozliczenia");
}

export async function createWorkEntry(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const { workDate, realizationId, quantity, notes } = parsed.data;

  // Wpis zawsze należy do zalogowanej osoby. Tylko administrator może dodać
  // wpis za kogoś innego (formularz w rozliczeniach przesyła wtedy `userId`).
  let ownerId = user.id;
  const requestedOwner = fieldValue(formData, "userId");

  if (requestedOwner && requestedOwner !== user.id) {
    if (!user.isAdmin) {
      return { message: "Możesz dodawać wpisy tylko za siebie." };
    }

    const owner = await prisma.user.findUnique({
      where: { id: requestedOwner },
      select: { id: true },
    });

    if (!owner) return { message: "Nie ma takiego pracownika." };

    ownerId = owner.id;
  }

  const problem = dateProblem(user, workDate);
  if (problem) return fieldError("workDate", problem);

  if (!realizationId) return fieldError("realizationId", "Wybierz realizację.");

  const realization = await prisma.realization.findUnique({
    where: { id: realizationId },
    select: { id: true, name: true },
  });

  if (!realization) return fieldError("realizationId", "Ta realizacja już nie istnieje.");

  await prisma.workEntry.create({
    data: {
      userId: ownerId,
      realizationId: realization.id,
      realizationName: realization.name,
      workDate: toUtcDate(workDate),
      quantity,
      notes,
    },
  });

  revalidateEntries();

  return { ok: true, message: "Zapisano wpis.", savedAt: Date.now() };
}

export async function updateWorkEntry(
  id: string,
  returnTo: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const existing = await prisma.workEntry.findUnique({
    where: { id },
    select: { userId: true, workDate: true, realizationId: true },
  });

  if (!existing) return { message: "Ten wpis już nie istnieje." };

  if (!canChangeEntryOn(user, { userId: existing.userId, workDate: dateOf(existing.workDate) })) {
    return { message: "Tego wpisu nie można już zmienić. Poproś administratora." };
  }

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const { workDate, realizationId, quantity, notes } = parsed.data;

  const problem = dateProblem(user, workDate);
  if (problem) return fieldError("workDate", problem);

  // Realizację można zostawić pustą tylko wtedy, gdy wpis już nie ma realizacji
  // (została usunięta) — wtedy zachowujemy zapisaną nazwę.
  let realizationData: { realizationId: string; realizationName: string } | null = null;

  if (realizationId) {
    const realization = await prisma.realization.findUnique({
      where: { id: realizationId },
      select: { id: true, name: true },
    });

    if (!realization) return fieldError("realizationId", "Ta realizacja już nie istnieje.");

    realizationData = { realizationId: realization.id, realizationName: realization.name };
  } else if (existing.realizationId !== null) {
    return fieldError("realizationId", "Wybierz realizację.");
  }

  await prisma.workEntry.update({
    where: { id },
    data: { workDate: toUtcDate(workDate), quantity, notes, ...(realizationData ?? {}) },
  });

  revalidateEntries();

  redirect(safeReturnPath(returnTo));
}

export async function deleteWorkEntry(id: string, returnTo: string) {
  const user = await requireUser();

  const existing = await prisma.workEntry.findUnique({
    where: { id },
    select: { userId: true, workDate: true },
  });

  // Wpis zniknął w innej karcie — nie ma czego usuwać, wracamy do listy.
  if (!existing) redirect(safeReturnPath(returnTo));

  if (!canChangeEntryOn(user, { userId: existing.userId, workDate: dateOf(existing.workDate) })) {
    redirect(safeReturnPath(returnTo));
  }

  await prisma.workEntry.delete({ where: { id } });

  revalidateEntries();

  redirect(safeReturnPath(returnTo));
}
