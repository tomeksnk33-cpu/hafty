import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";

// Ustawienia pralni dla wszystkich urządzeń. Odczyt zwraca /api/pralnia/katalog;
// zmienia tylko administrator.

const schema = z.object({ hideVoice: z.boolean().optional(), hideRouteDate: z.boolean().optional() });

export async function PUT(request: Request) {
  const { denied } = await laundryUser({ admin: true });
  if (denied) return denied;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {}
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const saved = await prisma.laundrySettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
    select: { hideVoice: true, hideRouteDate: true },
  });
  return NextResponse.json(saved);
}
