import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";

import { createClient } from "../actions";
import { ClientForm, emptyClient } from "../client-form";

export default async function NewClientPage() {
  await requireManager();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nowy klient" />
      <ClientForm
        action={createClient}
        defaults={emptyClient}
        submitLabel="Zapisz klienta"
        cancelHref="/klienci"
      />
    </div>
  );
}
