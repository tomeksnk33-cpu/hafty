import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderDetails } from "@/components/order-details";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { createOrderFromTemplate } from "../../actions";
import { QuantityForm } from "./quantity-form";

export const dynamic = "force-dynamic";

export default async function TemplateOrderPage(props: PageProps<"/moje-zlecenia/szablon/[id]">) {
  const user = await requireClient();
  const { id } = await props.params;

  // Tylko szablony tego klienta — cudzy wygląda jak nieistniejący.
  const template = await prisma.orderTemplate.findFirst({
    where: { id, clientId: user.clientId },
    include: { photos: { orderBy: { position: "asc" } } },
  });

  if (!template) notFound();

  return (
    <>
      <Link href="/moje-zlecenia" className="text-sm text-muted hover:text-ink">
        ← Moje zlecenia
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-semibold tracking-tight">{template.name}</h1>

      <div className="mb-6">
        <QuantityForm action={createOrderFromTemplate.bind(null, template.id)} />
      </div>

      <OrderDetails order={{ ...template, quantity: null, createdAt: null }} />
    </>
  );
}
