import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/confirm-action";
import { OrderDetails, OrderStatusBadge } from "@/components/order-details";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orderNumber } from "@/lib/orders";

import { cancelOwnOrder } from "../actions";
import { saveOrderAsTemplate } from "../szablony/actions";

export const dynamic = "force-dynamic";

export default async function MyOrderPage(props: PageProps<"/moje-zlecenia/[id]">) {
  const user = await requireClient();
  const { id } = await props.params;
  const search = await props.searchParams;

  // Cudze zlecenie wygląda tak samo jak nieistniejące.
  const order = await prisma.embroideryOrder.findFirst({
    where: { id, clientId: user.clientId },
    include: {
      photos: { orderBy: { position: "asc" } },
      logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
    },
  });

  if (!order) notFound();

  return (
    <>
      <Link href="/moje-zlecenia" className="text-sm text-muted hover:text-ink">
        ← Moje zlecenia
      </Link>

      {search.wyslane ? (
        <p role="status" className="card mt-4 border-[#86efac] bg-[#f0fdf4] px-5 py-4 text-lg">
          ✓ Zlecenie zostało wysłane. Damy znać, gdy będzie gotowe.
        </p>
      ) : null}

      <div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Zlecenie {orderNumber(order.number)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <OrderDetails order={order} />

      <form action={saveOrderAsTemplate.bind(null, order.id)} className="mt-6">
        <button type="submit" className="btn-secondary px-5 py-3 text-base">
          ☆ Zapisz jako szablon
        </button>
        <p className="mt-1 text-sm text-muted">Następnym razem zamówisz to samo, podając tylko ilość.</p>
      </form>

      {order.status === "NOWE" ? (
        <div className="mt-8 border-t border-line pt-6">
          <ConfirmAction
            action={cancelOwnOrder.bind(null, order.id)}
            label="Wycofaj zlecenie"
            title="Wycofać zlecenie?"
            text={`Zlecenie ${orderNumber(order.number)} zostanie anulowane.`}
            confirmLabel="Tak, wycofaj"
            buttonClassName="btn-danger px-5 py-3 text-base"
            danger
          />
          <p className="mt-2 text-sm text-muted">Zlecenie można wycofać, dopóki nie zaczęliśmy go realizować.</p>
        </div>
      ) : null}
    </>
  );
}
