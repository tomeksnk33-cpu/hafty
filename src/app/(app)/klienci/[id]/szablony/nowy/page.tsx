import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderForm } from "@/components/order-form";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { createTemplate } from "../actions";

export default async function NewTemplatePage(props: PageProps<"/klienci/[id]/szablony/nowy">) {
  await requireManager();
  const { id } = await props.params;

  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/klienci/${client.id}`} className="text-sm text-muted hover:text-ink">
        ← {client.name}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Nowy szablon zlecenia</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Klient „{client.name}” wybierze ten szablon i poda tylko ilość.
      </p>
      <OrderForm
        template
        action={createTemplate.bind(null, client.id)}
        cancelHref={`/klienci/${client.id}`}
        submitLabel="Zapisz szablon"
      />
    </div>
  );
}
