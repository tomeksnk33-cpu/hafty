import { PageHeader } from "@/components/page-header";

import { createThread } from "../actions";
import { emptyThread, ThreadForm } from "../thread-form";

export default function NewThreadPage() {
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
