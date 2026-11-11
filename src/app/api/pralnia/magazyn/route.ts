import { NextResponse } from "next/server";
import { z } from "zod";

import { LaundryStockKind, LaundryUnit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";
import { currentStock, unitIn, unitOut } from "@/lib/pralnia/stock";

export const dynamic = "force-dynamic";

// Magazyn czystego prania. Pracownik pralni wpisuje, co wyprał (partia
// z telefonu/ekranu dotykowego), kierowca zabiera pranie trasą (/api/pralnia/trasy),
// kierownik może poprawić stan pozycji.

const r2 = (n: number) => Math.round(n * 100) / 100;

const lineSchema = z.object({
  client: z.string().trim().min(1).max(120),
  item: z.string().trim().min(1).max(120),
  qty: z.number().finite().positive().max(100_000),
  unit: z.enum(["szt", "kg", "szt_kg"]).optional(),
  kg: z.number().finite().nonnegative().max(100_000).optional(),
});

const batchSchema = z.object({
  /** Id partii nadane przez urządzenie: ponowne wysłanie nie dubluje wpisów. */
  id: z.string().trim().min(1).max(64),
  entries: z.array(lineSchema).min(1).max(2000),
});

const correctionSchema = z.object({
  client: z.string().trim().min(1).max(120),
  item: z.string().trim().min(1).max(120),
  unit: z.enum(["szt", "kg", "szt_kg"]),
  /** Nowy stan (nie różnica). */
  qty: z.number().finite().min(0).max(100_000),
  kg: z.number().finite().min(0).max(100_000).optional(),
});

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Stan magazynu i ostatnie przyjęcia. Dla każdego pracownika pralni. */
export async function GET() {
  const { denied } = await laundryUser();
  if (denied) return denied;

  const [stock, recent] = await Promise.all([
    currentStock(),
    prisma.laundryStockMove.findMany({
      where: { kind: { in: [LaundryStockKind.WASHED, LaundryStockKind.CORRECTION] } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        kind: true,
        clientName: true,
        itemName: true,
        unit: true,
        quantity: true,
        weightKg: true,
        workerName: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    stock,
    recent: recent.map((m) => ({
      kind: m.kind === LaundryStockKind.CORRECTION ? "korekta" : "wyprane",
      client: m.clientName,
      item: m.itemName,
      unit: unitOut(m.unit),
      qty: m.quantity,
      kg: m.weightKg ?? 0,
      worker: m.workerName,
      date: m.createdAt,
    })),
  });
}

/** Partia wypranego prania na magazyn. Pracownik pralni i kierownik — kierowca tylko zabiera trasą. */
export async function POST(request: Request) {
  const { user, denied } = await laundryUser();
  if (denied) return denied;
  if (!user.canStockLaundry) {
    return NextResponse.json({ error: "Kierowca nie wpisuje prania na magazyn, tylko zabiera je na trasę." }, { status: 403 });
  }

  const parsed = batchSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  const { id, entries } = parsed.data;

  // ta sama partia wysłana drugi raz (zerwane połączenie) — już zapisana
  if (await prisma.laundryStockMove.findFirst({ where: { batchId: id }, select: { id: true } })) {
    return NextResponse.json({ saved: true, duplicate: true });
  }

  // jednostka z asortymentu na serwerze, gdy pozycja nadal istnieje
  const items = await prisma.laundryCatalogEntry.findMany({
    where: { kind: "ITEM" },
    select: { name: true, unit: true },
  });
  const units = new Map(items.map((i) => [i.name.toLowerCase(), i.unit]));

  await prisma.laundryStockMove.createMany({
    data: entries.map((e) => {
      let unit = units.get(e.item.toLowerCase()) ?? unitIn(e.unit);
      if (unit === LaundryUnit.SZT_KG && e.kg === undefined) unit = unitIn(e.unit === "szt_kg" ? "szt" : e.unit);
      return {
        kind: LaundryStockKind.WASHED,
        clientName: e.client,
        itemName: e.item,
        unit,
        quantity: unit === LaundryUnit.KG ? r2(e.qty) : Math.round(e.qty),
        weightKg: unit === LaundryUnit.SZT_KG ? r2(e.kg ?? 0) : null,
        workerName: user.name,
        userId: user.id,
        batchId: id,
      };
    }),
  });

  return NextResponse.json({ saved: true }, { status: 201 });
}

/** Korekta stanu jednej pozycji (np. pomyłka, zgubione). Kierownik pralni albo administrator. */
export async function PATCH(request: Request) {
  const { user, denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const parsed = correctionSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  const { client, item, qty, kg } = parsed.data;
  const unit = unitIn(parsed.data.unit);

  const [now] = await currentStock({ clientName: client, itemName: item, unit });
  const dq = r2((unit === LaundryUnit.KG ? r2(qty) : Math.round(qty)) - (now?.qty ?? 0));
  const dkg = unit === LaundryUnit.SZT_KG ? r2(r2(kg ?? 0) - (now?.kg ?? 0)) : 0;
  if (dq === 0 && dkg === 0) return NextResponse.json({ saved: true });

  await prisma.laundryStockMove.create({
    data: {
      kind: LaundryStockKind.CORRECTION,
      clientName: client,
      itemName: item,
      unit,
      quantity: dq,
      weightKg: unit === LaundryUnit.SZT_KG ? dkg : null,
      workerName: user.name,
      userId: user.id,
    },
  });

  return NextResponse.json({ saved: true });
}
