import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";

// Stałe trasy kierowcy (np. „Sanok”, „Krosno”). Listę zwraca /api/pralnia/katalog;
// tu tylko zmiany, dla kierownika pralni i administratora.

const nameSchema = z.string().trim().min(1, "Podaj nazwę trasy.").max(80);

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const taken = () => NextResponse.json({ error: "Trasa o tej nazwie już jest." }, { status: 409 });
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function POST(request: Request) {
  const { denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const parsed = z.object({ name: nameSchema }).safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  try {
    const line = await prisma.laundryLine.create({ data: parsed.data, select: { id: true, name: true } });
    return NextResponse.json(line, { status: 201 });
  } catch (e) {
    if (isUnique(e)) return taken();
    throw e;
  }
}

export async function PUT(request: Request) {
  const { denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const parsed = z.object({ id: z.string().min(1), name: nameSchema }).safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  try {
    const { count } = await prisma.laundryLine.updateMany({ where: { id: parsed.data.id }, data: { name: parsed.data.name } });
    if (count === 0) return NextResponse.json({ error: "Tej trasy już nie ma." }, { status: 404 });
  } catch (e) {
    if (isUnique(e)) return taken();
    throw e;
  }
  return NextResponse.json({ saved: true });
}

/** Usunięcie trasy; jej klienci zostają, tylko bez przypisanej trasy. */
export async function DELETE(request: Request) {
  const { denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Brak id." }, { status: 400 });
  await prisma.laundryLine.deleteMany({ where: { id } });
  return NextResponse.json({ deleted: true });
}
