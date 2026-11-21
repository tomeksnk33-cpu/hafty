import Link from "next/link";

import { OrderStatusBadge } from "@/components/order-details";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { logosText, orderNumber } from "@/lib/orders";

import { TemplateTiles } from "./template-tiles";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const user = await requireClient();

  // Zawsze filtr po kliencie z sesji — klient nie zobaczy cudzych zleceń.
  const orders = await prisma.embroideryOrder.findMany({
    where: { clientId: user.clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      product: true,
      logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
      quantity: true,
      status: true,
      createdAt: true,
      _count: { select: { photos: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Moje zlecenia</h1>
          <p className="mt-1 text-sm text-muted">Haft i nadruk DTF — złóż zlecenie i sprawdzaj, na jakim jest etapie.</p>
        </div>
        <Link href="/moje-zlecenia/nowe" className="btn-primary px-6 py-4 text-lg">
          + Nowe zlecenie
        </Link>
      </div>

      <TemplateTiles clientId={user.clientId} />

      {orders.length > 0 ? <h2 className="mb-3 text-lg font-semibold">Złożone zlecenia</h2> : null}

      {orders.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-lg font-medium">Nie masz jeszcze zleceń.</p>
          <p className="mt-1 text-muted">Kliknij „Nowe zlecenie”, wybierz haft albo DTF, dodaj zdjęcie asortymentu i ilość.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/moje-zlecenia/${order.id}`}
                className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted">
                    {orderNumber(order.number)} · {formatDate(order.createdAt)}
                  </p>
                  <p className="truncate text-lg font-semibold">
                    {order.product} <span className="font-normal text-muted">× {order.quantity} szt.</span>
                  </p>
                  <p className="truncate text-sm text-muted">
                    {logosText(order.logos)}
                    {order._count.photos > 0 ? ` · 📷 ${order._count.photos}` : ""}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
