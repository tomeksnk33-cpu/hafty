import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/confirm-action";
import { OrderForm } from "@/components/order-form";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LOGO_QUERY } from "@/lib/orders";

import { deleteOwnTemplate, updateOwnTemplate } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditOwnTemplatePage(props: PageProps<"/moje-zlecenia/szablony/[id]">) {
  const user = await requireClient();
  const { id } = await props.params;
  const search = await props.searchParams;

  // Tylko szablony tego klienta — cudzy wygląda jak nieistniejący.
  const template = await prisma.orderTemplate.findFirst({
    where: { id, clientId: user.clientId },
    include: {
      photos: { orderBy: { position: "asc" } },
      logos: LOGO_QUERY,
    },
  });

  if (!template) notFound();

  return (
    <>
      <Link href="/moje-zlecenia/szablony" className="text-sm text-muted hover:text-ink">
        ← Moje szablony
      </Link>

      {search.zlecenia ? (
        <p role="status" className="card mt-4 border-[#86efac] bg-[#f0fdf4] px-5 py-3">
          ✓ Zlecenie zapisane jako szablon. Możesz zmienić jego nazwę i zapisać.
        </p>
      ) : null}

      <div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Szablon: {template.name}</h1>
        <Link href={`/moje-zlecenia/szablon/${template.id}`} className="btn-primary px-5 py-3 text-base">
          Zamów z tego szablonu
        </Link>
      </div>

      <OrderForm
        template
        action={updateOwnTemplate.bind(null, template.id)}
        cancelHref="/moje-zlecenia/szablony"
        submitLabel="Zapisz zmiany"
        defaults={{
          name: template.name,
          product: template.product,
          logos: template.logos,
          notes: template.notes ?? "",
          photos: template.photos.map(({ url, pathname, filename, sizeBytes }) => ({ url, pathname, filename, sizeBytes })),
        }}
      />

      <div className="mt-10 border-t border-line pt-6">
        <ConfirmAction
          action={deleteOwnTemplate.bind(null, template.id)}
          label="Usuń szablon"
          title="Usunąć szablon?"
          text={`Szablon „${template.name}” zniknie. Złożone zlecenia zostają.`}
          confirmLabel="Tak, usuń"
          buttonClassName="btn-danger px-5 py-3 text-base"
          danger
        />
      </div>
    </>
  );
}
