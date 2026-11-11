import { NextResponse } from "next/server";
import { z } from "zod";

import { LaundryCatalogKind, LaundryPickupSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";

export const dynamic = "force-dynamic";

// Lista „Do odebrania": zgłoszenia odbioru prania (SMS od klienta albo dodane
// ręcznie). Widzi ją, dodaje i odhacza każdy pracownik pralni — to kierowca
// jeździ po pranie. Usuwa tylko administrator.

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Otwarte zgłoszenia i te odhaczone w ostatniej dobie (żeby dało się cofnąć pomyłkę). */
export async function GET() {
  const { denied } = await laundryUser();
  if (denied) return denied;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.laundryPickup.findMany({
    where: { OR: [{ doneAt: null }, { doneAt: { gte: since } }] },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      client: r.clientName,
      phone: r.phone,
      message: r.message,
      source: r.source === LaundryPickupSource.SMS ? "sms" : "manual",
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      doneAt: r.doneAt?.toISOString() ?? null,
      doneBy: r.doneBy,
    })),
  );
}

const createSchema = z.object({
  clientId: z.string().min(1),
  message: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const { user, denied } = await laundryUser();
  if (denied) return denied;

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Wybierz klienta." }, { status: 400 });

  const client = await prisma.laundryCatalogEntry.findFirst({
    where: { id: parsed.data.clientId, kind: LaundryCatalogKind.CLIENT },
    select: { id: true, name: true },
  });
  if (!client) return NextResponse.json({ error: "Nie ma już tego klienta." }, { status: 404 });

  const row = await prisma.laundryPickup.create({
    data: {
      clientId: client.id,
      clientName: client.name,
      message: parsed.data.message || null,
      source: LaundryPickupSource.MANUAL,
      createdBy: user.name,
    },
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  done: z.boolean(),
  /** Przypisanie SMS-a z nieznanego numeru do klienta (opcjonalnie). */
  clientId: z.string().min(1).optional(),
});

export async function PATCH(request: Request) {
  const { user, denied } = await laundryUser();
  if (denied) return denied;

  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const { id, done, clientId } = parsed.data;
  let client: { id: string; name: string } | null = null;
  if (clientId) {
    client = await prisma.laundryCatalogEntry.findFirst({
      where: { id: clientId, kind: LaundryCatalogKind.CLIENT },
      select: { id: true, name: true },
    });
    if (!client) return NextResponse.json({ error: "Nie ma już tego klienta." }, { status: 404 });
  }

  const { count } = await prisma.laundryPickup.updateMany({
    where: { id },
    data: {
      doneAt: done ? new Date() : null,
      doneBy: done ? user.name : null,
      ...(client ? { clientId: client.id, clientName: client.name } : {}),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Tego zgłoszenia już nie ma." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Brak id." }, { status: 400 });
  await prisma.laundryPickup.deleteMany({ where: { id } });
  return NextResponse.json({ deleted: true });
}
