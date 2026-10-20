import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";

import { createThread } from "../actions";
import { emptyThread, ThreadForm } from "../thread-form";

export default async function NewThreadPage() {
  await requireManager();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nowa nić" subtitle="Producent i numer razem muszą być unikalne." />
      <ThreadForm
        action={createThread}
        defaults={emptyThread}
        submitLabel="Zapisz nić"
        cancelHref="/nici"
      />
    </div>
  );
}
