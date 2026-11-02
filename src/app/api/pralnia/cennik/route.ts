import { NextResponse } from "next/server";
import { z } from "zod";

import { LaundryCatalogKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";

export const dynamic = "force-dynamic";

// Cennik prania: osobna cena każdej pozycji asortymentu u każdego klienta.
// Widzi i zmienia go tylko administrator.

export async function GET() {
  const { denied } = await laundryUser({ admin: true });
  if (denied) return denied;

  const rows = await prisma.laundryPrice.findMany({
    select: {
      clientId: true,
      itemId: true,
      perPiece: true,
      perKg: true,
      client: { select: { name: true } },
      item: { select: { name: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      clientId: r.clientId,
      itemId: r.itemId,
      client: r.client.name,
      item: r.item.name,
      szt: r.perPiece,
      kg: r.perKg,
    })),
  );
}

const price = z
  .number()
  .min(0, "Cena nie może być ujemna.")
  .max(100000, "Za duża cena.")
  .transform((v) => Math.round(v * 100) / 100)
  .nullable()
  .default(null);

const putSchema = z.object({
  clientId: z.string().min(1),
  itemId: z.string().min(1),
  szt: price,
  kg: price,
});

export async function PUT(request: Request) {
  const { denied } = await laundryUser({ admin: true });
  if (denied) return denied;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {}
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  const { clientId, itemId, szt, kg } = parsed.data;

  const found = await prisma.laundryCatalogEntry.findMany({
    where: { id: { in: [clientId, itemId] } },
    select: { id: true, kind: true },
  });
  const kindOf = (id: string) => found.find((f) => f.id === id)?.kind;
  if (kindOf(clientId) !== LaundryCatalogKind.CLIENT || kindOf(itemId) !== LaundryCatalogKind.ITEM) {
    return NextResponse.json({ error: "Ktoś usunął tego klienta albo asortyment. Odśwież listę." }, { status: 404 });
  }

  // Brak obu cen = usunięcie pozycji z cennika.
  if (szt === null && kg === null) {
    await prisma.laundryPrice.deleteMany({ where: { clientId, itemId } });
  } else {
    await prisma.laundryPrice.upsert({
      where: { clientId_itemId: { clientId, itemId } },
      create: { clientId, itemId, perPiece: szt, perKg: kg },
      update: { perPiece: szt, perKg: kg },
    });
  }

  return NextResponse.json({ clientId, itemId, szt, kg });
}
