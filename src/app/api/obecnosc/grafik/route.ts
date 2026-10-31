import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { attendanceUser } from "@/lib/obecnosc/access";

export const dynamic = "force-dynamic";

/** Okresy pracy rozpoczęte między `od` a `do` (ISO). Tylko dla administratora. */
export async function GET(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const from = new Date(params.get("od") ?? "");
  const to = new Date(params.get("do") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: "Podaj zakres dat." }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 62 * 24 * 3600 * 1000) {
    return NextResponse.json({ error: "Zakres może mieć najwyżej dwa miesiące." }, { status: 400 });
  }

  const shifts = await prisma.attendanceShift.findMany({
    where: { startedAt: { gte: from, lt: to } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      personId: true,
      startedAt: true,
      endedAt: true,
      edited: true,
      person: { select: { name: true } },
    },
  });

  return NextResponse.json(
    shifts.map(({ person, ...s }) => ({ ...s, name: person.name })),
  );
}
