import { NextResponse } from "next/server";
import { z } from "zod";

import { LaundryCatalogKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";

// Wspólna lista klientów i asortymentu pralni. Tak jak w dawnej aplikacji z
// PIN-em, zmieniać ją może każdy zalogowany pracownik — kierowcy dopisują
// klientów w trasie. Każda zmiana dotyczy jednego wiersza, więc dwie osoby
// edytujące naraz nie nadpisują sobie nawzajem całej listy.

const kindSchema = z.enum(["clients", "items"]);
const KIND = { clients: LaundryCatalogKind.CLIENT, items: LaundryCatalogKind.ITEM } as const;

const entrySchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę.").max(120),
  aliases: z
    .array(z.string())
    .default([])
    .transform((list) =>
      [...new Set(list.map((a) => a.trim().slice(0, 120)).filter(Boolean))].slice(0, 30),
    ),
});

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
    select: { id: true, kind: true, name: true, aliases: true },
  });

  const pick = (kind: LaundryCatalogKind) =>
    rows.filter((r) => r.kind === kind).map(({ id, name, aliases }) => ({ id, name, aliases }));

  return NextResponse.json({
    user: { name: user.name },
    clients: pick(LaundryCatalogKind.CLIENT),
    items: pick(LaundryCatalogKind.ITEM),
  });
}

export async function POST(request: Request) {
  const { denied } = await laundryUser();
  if (denied) return denied;

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { kind, name, aliases } = parsed.data;
  const entry = await prisma.laundryCatalogEntry.create({
    data: { kind: KIND[kind], name, aliases },
    select: { id: true, name: true, aliases: true },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(request: Request) {
  const { denied } = await laundryUser();
  if (denied) return denied;

  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);

  const { id, name, aliases } = parsed.data;
  const { count } = await prisma.laundryCatalogEntry.updateMany({ where: { id }, data: { name, aliases } });

  if (count === 0) {
    return NextResponse.json({ error: "Ktoś inny usunął tę pozycję. Odświeżono listę." }, { status: 404 });
  }

  return NextResponse.json({ id, name, aliases });
}

export async function DELETE(request: Request) {
  const { denied } = await laundryUser();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Brak id." }, { status: 400 });

  await prisma.laundryCatalogEntry.deleteMany({ where: { id } });

  return NextResponse.json({ deleted: true });
}
