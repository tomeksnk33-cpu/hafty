import { NextResponse } from "next/server";
import { z } from "zod";

import { LaundryCatalogKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";
import { locationOut } from "@/lib/pralnia/location";

// Lokalizacja klienta pralni (GPS telefonu), do planowania trasy kierowcy.
// Zapisać ją może każdy pracownik pralni, bo to kierowca stoi u klienta —
// ten endpoint zmienia wyłącznie współrzędne, nie nazwę ani inne dane klienta.
// Usunąć zapisaną lokalizację może tylko administrator.

const saveSchema = z.object({
  clientId: z.string().min(1),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100_000).nullish(),
});

const select = {
  latitude: true,
  longitude: true,
  locationAccuracy: true,
  locatedAt: true,
  locatedBy: true,
} as const;

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const gone = () =>
  NextResponse.json({ error: "Ktoś inny usunął tego klienta. Odświeżono listę." }, { status: 404 });

export async function PUT(request: Request) {
  const { user, denied } = await laundryUser();
  if (denied) return denied;

  const parsed = saveSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe współrzędne." }, { status: 400 });
  }

  const { clientId, lat, lng, accuracy } = parsed.data;
  const { count } = await prisma.laundryCatalogEntry.updateMany({
    where: { id: clientId, kind: LaundryCatalogKind.CLIENT },
    data: {
      latitude: lat,
      longitude: lng,
      locationAccuracy: accuracy == null ? null : Math.round(accuracy),
      locatedAt: new Date(),
      locatedBy: user.name,
    },
  });
  if (count === 0) return gone();

  const row = await prisma.laundryCatalogEntry.findUnique({ where: { id: clientId }, select });
  return NextResponse.json({ location: row ? locationOut(row) : null });
}

export async function DELETE(request: Request) {
  const { denied } = await laundryUser({ admin: true });
  if (denied) return denied;

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "Brak id klienta." }, { status: 400 });

  const { count } = await prisma.laundryCatalogEntry.updateMany({
    where: { id: clientId, kind: LaundryCatalogKind.CLIENT },
    data: { latitude: null, longitude: null, locationAccuracy: null, locatedAt: null, locatedBy: null },
  });
  if (count === 0) return gone();

  return NextResponse.json({ location: null });
}
