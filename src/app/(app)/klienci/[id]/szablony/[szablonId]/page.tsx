import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/confirm-action";
import { OrderForm } from "@/components/order-form";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";

import { deleteTemplate, updateTemplate } from "../actions";

export default async function EditTemplatePage(props: PageProps<"/klienci/[id]/szablony/[szablonId]">) {
  await requireManager();
  const { id, szablonId } = await props.params;

  const template = await prisma.orderTemplate.findFirst({
    where: { id: szablonId, clientId: id },
    include: {
      client: { select: { id: true, name: true } },
      photos: { orderBy: { position: "asc" } },
      logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
      _count: { select: { orders: true } },
    },
  });

  if (!template) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/klienci/${template.client.id}`} className="text-sm text-muted hover:text-ink">
        ← {template.client.name}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Szablon: {template.name}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Złożono z niego {template._count.orders}{" "}
        {plural(template._count.orders, "zlecenie", "zlecenia", "zleceń")}. Zmiany dotyczą tylko kolejnych zleceń.
      </p>

      <OrderForm
        template
        action={updateTemplate.bind(null, template.client.id, template.id)}
        cancelHref={`/klienci/${template.client.id}`}
        submitLabel="Zapisz zmiany"
        defaults={{
          name: template.name,
          product: template.product,
          logos: template.logos,
          notes: template.notes ?? "",
          photos: template.photos.map(({ url, pathname, filename, sizeBytes }) => ({
            url,
            pathname,
            filename,
            sizeBytes,
          })),
        }}
      />

      <div className="mt-10 border-t border-line pt-6">
        <ConfirmAction
          action={deleteTemplate.bind(null, template.client.id, template.id)}
          label="Usuń szablon"
          title="Usunąć szablon?"
          text={`Klient nie będzie już mógł zamówić z szablonu „${template.name}”. Złożone zlecenia zostają.`}
          confirmLabel="Tak, usuń"
          buttonClassName="btn-danger"
          danger
        />
      </div>
    </div>
  );
}
