import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";

export const dynamic = "force-dynamic";

/**
 * Wszystkie dostawy z tras zakończonych między `od` a `do` (ISO), do kalendarza
 * klientów i podsumowania miesiąca. Tylko dla administratora.
 */
export async function GET(request: Request) {
  const { user, denied } = await laundryUser();
  if (denied) return denied;
  if (!user.isAdmin) return NextResponse.json({ error: "Grafik widzi tylko administrator." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const from = new Date(params.get("od") ?? "");
  const to = new Date(params.get("do") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: "Podaj zakres dat." }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 62 * 24 * 3600 * 1000) {
    return NextResponse.json({ error: "Zakres może mieć najwyżej dwa miesiące." }, { status: 400 });
  }

  const routes = await prisma.laundryRoute.findMany({
    where: { finishedAt: { gte: from, lt: to } },
    orderBy: { finishedAt: "asc" },
    select: {
      id: true,
      finishedAt: true,
      workerName: true,
      entries: {
        orderBy: { position: "asc" },
        select: { clientName: true, itemName: true, quantity: true, unit: true },
      },
    },
  });

  return NextResponse.json(
    routes.flatMap((r) =>
      r.entries.map((e) => ({
        routeId: r.id,
        date: r.finishedAt,
        worker: r.workerName,
        client: e.clientName,
        item: e.itemName,
        qty: e.quantity,
        unit: e.unit === "KG" ? "kg" : "szt",
      })),
    ),
  );
}
