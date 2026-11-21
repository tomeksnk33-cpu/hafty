import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/confirm-action";
import { OrderDetails, OrderStatusBadge } from "@/components/order-details";
import { requireEmbroideryUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, orderNumber } from "@/lib/orders";

import { deleteOrder, setOrderStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrderPage(props: PageProps<"/zlecenia/[id]">) {
  const user = await requireEmbroideryUser();
  const { id } = await props.params;

  const order = await prisma.embroideryOrder.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      client: { select: { id: true, name: true, company: true, phone: true, email: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!order) notFound();

  const contact = [order.client.company, order.client.phone, order.client.email].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/zlecenia" className="text-sm text-muted hover:text-ink">
        ← Zlecenia klientów
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zlecenie {orderNumber(order.number)}</h1>
          <p className="mt-1 text-sm text-muted">
            {user.canManage ? (
              <Link href={`/klienci/${order.client.id}`} className="font-medium text-accent hover:underline">
                {order.client.name}
              </Link>
            ) : (
              <span className="font-medium text-ink">{order.client.name}</span>
            )}
            {contact.length > 0 ? ` · ${contact.join(" · ")}` : ""}
            {order.createdBy ? ` · złożył(a): ${order.createdBy.name}` : ""}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-semibold">Etap zlecenia</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ORDER_STATUSES.map((status) => (
            <form key={status} action={setOrderStatus.bind(null, order.id, status)}>
              <button
                type="submit"
                disabled={order.status === status}
                className={`w-full rounded-xl border-2 px-3 py-4 text-base font-medium ${
                  order.status === status
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                {ORDER_STATUS_LABEL[status]}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Klient widzi etap na swojej liście zleceń.</p>
      </section>

      <OrderDetails order={order} />

      {user.canManage ? (
        <div className="mt-10 border-t border-line pt-6">
          <ConfirmAction
            action={deleteOrder.bind(null, order.id)}
            label="Usuń zlecenie"
            title="Usunąć zlecenie?"
            text={`Zlecenie ${orderNumber(order.number)} i jego zdjęcia znikną na stałe — także z listy klienta. Żeby tylko je zamknąć, ustaw etap „Anulowane”.`}
            confirmLabel="Tak, usuń"
            buttonClassName="btn-danger"
            danger
          />
        </div>
      ) : null}
    </div>
  );
}
