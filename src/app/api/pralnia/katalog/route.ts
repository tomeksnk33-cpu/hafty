import { NextResponse } from "next/server";
import { z } from "zod";

import { LaundryCatalogKind, LaundryUnit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";
import { locationOut } from "@/lib/pralnia/location";
import { normalizePhone } from "@/lib/pralnia/phone";
import { laundrySettings } from "@/lib/pralnia/settings";
import { laundryUsage } from "@/lib/pralnia/usage";

// Wspólna lista klientów i asortymentu pralni. Czytać ją musi każdy pracownik
// pralni (rozpoznawanie mowy), zmieniać tylko administrator. Każda zmiana
// dotyczy jednego wiersza, więc dwie osoby edytujące naraz nie nadpisują sobie
// nawzajem całej listy.

const kindSchema = z.enum(["clients", "items"]);
const KIND = { clients: LaundryCatalogKind.CLIENT, items: LaundryCatalogKind.ITEM } as const;

const entrySchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę.").max(120),
  /** Inne nazwy (dla rozpoznawania mowy); brak = bez zmian przy edycji. */
  aliases: z
    .array(z.string())
    .optional()
    .transform((list) =>
      list === undefined
        ? undefined
        : [...new Set(list.map((a) => a.trim().slice(0, 120)).filter(Boolean))].slice(0, 30),
    ),
  /** Tylko asortyment: w rozliczeniu miesięcznym liczony w kg (inaczej w sztukach). */
  billKg: z.boolean().optional(),
  /** Tylko klient: numery telefonów, z których może przyjść SMS o odbiór prania. */
  phones: z
    .array(z.string())
    .optional()
    .transform((list) =>
      list === undefined
        ? undefined
        : [...new Set(list.map(normalizePhone).filter((p): p is string => !!p))].slice(0, 10),
    ),
  /** Tylko klient: adres e-mail (pusty = brak). */
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Nieprawidłowy adres e-mail.")
    .transform((v) => v || null)
    .optional(),
  /** Tylko klient: stała trasa kierowcy (null = bez trasy). */
  lineId: z.string().min(1).nullable().optional(),
});

const unitOut = (unit: LaundryUnit) =>
  unit === LaundryUnit.KG ? "kg" : unit === LaundryUnit.SZT_KG ? "szt_kg" : "szt";

const createSchema = entrySchema.extend({ kind: kindSchema });
const updateSchema = entrySchema.extend({ id: z.string().min(1) });

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function invalid(error: z.ZodError) {
  return NextResponse.json({ error: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
}

export async function GET() {
  const { user, denied } = await laundryUser();
  if (denied) return denied;

  const rows = await prisma.laundryCatalogEntry.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      kind: true,
      name: true,
      aliases: true,
      unit: true,
      billKg: true,
      latitude: true,
      longitude: true,
      locationAccuracy: true,
      locatedAt: true,
      locatedBy: true,
      phones: true,
      email: true,
      lineId: true,
    },
  });
  const lines = await prisma.laundryLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const settings = await laundrySettings();

  const usage = await laundryUsage();
  const items = rows.filter((r) => r.kind === LaundryCatalogKind.ITEM);

  // `visits` (ile tras z tym klientem) i `items` (asortyment klienta, najczęstszy
  // najpierw) układają przyciski na ekranie dotykowym trasy.
  return NextResponse.json({
    user: { name: user.name, isAdmin: user.isAdmin, canManage: user.canManageLaundry, canDrive: user.canDriveLaundry, canStock: user.canStockLaundry },
    lines,
    settings,
    clients: rows
      .filter((r) => r.kind === LaundryCatalogKind.CLIENT)
      .map(({ id, name, aliases, phones, email, lineId, ...loc }) => ({
        id,
        name,
        aliases,
        phones,
        email,
        lineId,
        location: locationOut(loc),
        visits: usage.visits(name),
        items: usage.clientItems({ id, name }, items),
      })),
    items: items.map(({ id, name, aliases, unit, billKg }) => ({
      id,
      name,
      aliases,
      unit: unitOut(unit),
      billKg,
      uses: usage.itemTotal(name),
    })),
  });
}

const adminOnly = (what: string) =>
  NextResponse.json({ error: `${what} może tylko administrator.` }, { status: 403 });

export async function POST(request: Request) {
  const { user, denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { kind, name, aliases, billKg, phones, email, lineId } = parsed.data;
  // przypisanie klienta do trasy kierowcy zmienia trasę — tylko administrator
  if (kind === "clients" && lineId && !user.isAdmin) return adminOnly("Przypisać klienta do trasy");
  const entry = await prisma.laundryCatalogEntry.create({
    data: {
      kind: KIND[kind],
      name,
      aliases: aliases ?? [],
      // asortyment wpisuje się zawsze w sztukach i kilogramach
      unit: kind === "items" ? LaundryUnit.SZT_KG : LaundryUnit.SZT,
      billKg: kind === "items" ? billKg ?? false : false,
      phones: kind === "clients" ? phones ?? [] : [],
      email: kind === "clients" ? email ?? null : null,
      lineId: kind === "clients" ? lineId ?? null : null,
    },
    select: { id: true, name: true, aliases: true, unit: true, billKg: true },
  });

  return NextResponse.json({ ...entry, unit: unitOut(entry.unit) }, { status: 201 });
}

export async function PUT(request: Request) {
  const { user, denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { id, name, aliases, billKg, phones, email, lineId } = parsed.data;
  const before = await prisma.laundryCatalogEntry.findUnique({
    where: { id },
    select: { kind: true, name: true, lineId: true },
  });
  if (!before) {
    return NextResponse.json({ error: "Ktoś inny usunął tę pozycję. Odświeżono listę." }, { status: 404 });
  }
  // kierownik pralni asortyment tylko dodaje; trasy kierowców zmienia tylko administrator
  if (!user.isAdmin && before.kind === LaundryCatalogKind.ITEM) return adminOnly("Zmieniać asortyment");
  if (!user.isAdmin && lineId !== undefined && lineId !== before.lineId) return adminOnly("Zmieniać trasę klienta");

  await prisma.$transaction(async (tx) => {
    await tx.laundryCatalogEntry.update({
      where: { id },
      data: {
        name,
        ...(aliases ? { aliases } : {}),
        ...(billKg !== undefined && before.kind === LaundryCatalogKind.ITEM ? { billKg } : {}),
        ...(phones ? { phones } : {}),
        ...(email !== undefined && before.kind === LaundryCatalogKind.CLIENT ? { email } : {}),
        ...(lineId !== undefined && before.kind === LaundryCatalogKind.CLIENT ? { lineId } : {}),
      },
    });
    // stan magazynu jest zapisany po nazwach — po zmianie nazwy przenosimy go razem z nią
    if (before.name !== name) {
      const field = before.kind === LaundryCatalogKind.CLIENT ? "clientName" : "itemName";
      await tx.laundryStockMove.updateMany({ where: { [field]: before.name }, data: { [field]: name } });
    }
  });

  return NextResponse.json({ id, name });
}

export async function DELETE(request: Request) {
  const { user, denied } = await laundryUser({ manager: true });
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Brak id." }, { status: 400 });

  if (!user.isAdmin) {
    const entry = await prisma.laundryCatalogEntry.findUnique({ where: { id }, select: { kind: true } });
    if (entry?.kind === LaundryCatalogKind.ITEM) return adminOnly("Usuwać asortyment");
  }

  await prisma.laundryCatalogEntry.deleteMany({ where: { id } });

  return NextResponse.json({ deleted: true });
}
