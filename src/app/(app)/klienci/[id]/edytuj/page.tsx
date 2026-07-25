import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

import { updateClient } from "../../actions";
import { ClientForm } from "../../client-form";

export default async function EditClientPage(props: PageProps<"/klienci/[id]/edytuj">) {
  const { id } = await props.params;
  const client = await prisma.client.findUnique({ where: { id } });

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edycja klienta" subtitle={client.name} />
      <ClientForm
        action={updateClient.bind(null, client.id)}
        defaults={{
          name: client.name,
          company: client.company ?? "",
          phone: client.phone ?? "",
          email: client.email ?? "",
          notes: client.notes ?? "",
        }}
        submitLabel="Zapisz zmiany"
        cancelHref={`/klienci/${client.id}`}
      />
    </div>
  );
}
