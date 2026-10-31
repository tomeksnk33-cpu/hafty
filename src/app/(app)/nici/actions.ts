"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fieldValue, threadSchema, toFormState, type FormState } from "@/lib/validation";

const DUPLICATE: FormState = {
  message: "Taka nić już jest w katalogu — ten sam producent i numer.",
  errors: { number: ["Ta kombinacja producenta i numeru już istnieje"] },
};

function isDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function readForm(formData: FormData) {
  return threadSchema.safeParse({
    brand: fieldValue(formData, "brand"),
    number: fieldValue(formData, "number"),
    colorName: fieldValue(formData, "colorName"),
    hex: fieldValue(formData, "hex"),
  });
}

export async function createThread(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  try {
    await prisma.thread.create({ data: parsed.data });
  } catch (error) {
    if (isDuplicate(error)) return DUPLICATE;
    throw error;
  }

  revalidatePath("/nici");
  revalidatePath("/pulpit");

  redirect("/nici");
}

export async function updateThread(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();

  const parsed = readForm(formData);

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  try {
    await prisma.thread.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isDuplicate(error)) return DUPLICATE;
    throw error;
  }

  revalidatePath("/nici");
  revalidatePath(`/nici/${id}`);
  revalidatePath("/realizacje");

  redirect(`/nici/${id}`);
}

export async function deleteThread(id: string) {
  await requireManager();

  // Powiązania z realizacjami znikają kaskadowo, same realizacje zostają.
  await prisma.thread.delete({ where: { id } });

  revalidatePath("/nici");
  revalidatePath("/realizacje");

  redirect("/nici");
}

export type QuickThread = {
  id: string;
  brand: string;
  number: string;
  colorName: string | null;
  hex: string | null;
};

/**
 * Dodawanie nici bez wychodzenia z formularza realizacji. Zwraca dane nici
 * zamiast przekierowania, żeby `ThreadPicker` mógł ją od razu zaznaczyć.
 */
export async function createThreadInline(input: {
  brand: string;
  number: string;
  colorName: string;
  hex: string;
}): Promise<{ thread: QuickThread } | { error: string }> {
  await requireManager();

  const parsed = threadSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Niepoprawne dane nici." };
  }

  try {
    const thread = await prisma.thread.create({
      data: parsed.data,
      select: { id: true, brand: true, number: true, colorName: true, hex: true },
    });

    revalidatePath("/nici");

    return { thread };
  } catch (error) {
    if (isDuplicate(error)) {
      const existing = await prisma.thread.findUnique({
        where: { brand_number: { brand: parsed.data.brand, number: parsed.data.number } },
        select: { id: true, brand: true, number: true, colorName: true, hex: true },
      });

      // Nić już istnieje — dla użytkownika to nie błąd, tylko gotowy wybór.
      if (existing) return { thread: existing };
    }

    throw error;
  }
}

/** Podpowiedzi nici do pola wyszukiwania w formularzu realizacji. */
export async function searchThreads(query: string): Promise<QuickThread[]> {
  await requireManager();

  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return prisma.thread.findMany({
      orderBy: [{ brand: "asc" }, { number: "asc" }],
      take: 20,
      select: { id: true, brand: true, number: true, colorName: true, hex: true },
    });
  }

  return prisma.thread.findMany({
    where: {
      OR: [
        { number: { contains: trimmed, mode: "insensitive" } },
        { colorName: { contains: trimmed, mode: "insensitive" } },
        { brand: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    orderBy: [{ brand: "asc" }, { number: "asc" }],
    take: 20,
    select: { id: true, brand: true, number: true, colorName: true, hex: true },
  });
}
