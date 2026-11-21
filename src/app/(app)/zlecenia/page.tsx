import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-header";
import { OrderStatusBadge } from "@/components/order-details";
import { requireEmbroideryUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  type OrderStatusValue,
  orderNumber,
  logosText,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Domyślnie widać zlecenia do zrobienia: nowe i w realizacji. */
const OPEN: OrderStatusValue[] = ["NOWE", "W_REALIZACJI"];

export default async function OrdersPage(props: PageProps<"/zlecenia">) {
  await requireEmbroideryUser();
  const search = await props.searchParams;
  const wanted = typeof search.status === "string" ? search.status : "";
  const status = (ORDER_STATUSES as readonly string[]).includes(wanted) ? (wanted as OrderStatusValue) : null;
  const all = wanted === "wszystkie";

  const [orders, counts] = await Promise.all([
    prisma.embroideryOrder.findMany({
      where: all ? {} : { status: status ? status : { in: OPEN } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        client: { select: { id: true, name: true, company: true } },
        _count: { select: { photos: true } },
        logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
      },
    }),
    prisma.embroideryOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (value: OrderStatusValue) => counts.find((row) => row.status === value)?._count._all ?? 0;

  const filters: { href: string; label: string; active: boolean }[] = [
    { href: "/zlecenia", label: `Do zrobienia (${countOf("NOWE") + countOf("W_REALIZACJI")})`, active: !status && !all },
    ...ORDER_STATUSES.map((value) => ({
      href: `/zlecenia?status=${value}`,
      label: `${ORDER_STATUS_LABEL[value]} (${countOf(value)})`,
      active: status === value,
    })),
    { href: "/zlecenia?status=wszystkie", label: "Wszystkie", active: all },
  ];

  return (
    <>
      <PageHeader
        title="Zlecenia klientów"
        subtitle="Zlecenia składane przez klientów z kontem. Konto zakłada się na karcie klienta."
      />

      <nav className="mb-5 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.href}
            href={filter.href}
            aria-current={filter.active ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              filter.active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState title="Brak zleceń w tym widoku." />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/zlecenia/${order.id}`}
                className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted">
                    {orderNumber(order.number)} · {formatDate(order.createdAt)} ·{" "}
                    <span className="font-medium text-ink">{order.client.name}</span>
                    {order.client.company ? ` (${order.client.company})` : ""}
                  </p>
                  <p className="truncate text-lg font-semibold">
                    {order.product}{" "}
                    <span className="font-normal text-muted">× {order.quantity} szt.</span>
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
