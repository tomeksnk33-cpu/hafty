import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { updateThread } from "../../actions";
import { ThreadForm } from "../../thread-form";

export default async function EditThreadPage(props: PageProps<"/nici/[id]/edytuj">) {
  await requireManager();

  const { id } = await props.params;
  const thread = await prisma.thread.findUnique({ where: { id } });

  if (!thread) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Edycja nici"
        subtitle={`${thread.brand} ${thread.number}`}
      />
      <ThreadForm
        action={updateThread.bind(null, thread.id)}
        defaults={{
          brand: thread.brand,
          number: thread.number,
          colorName: thread.colorName ?? "",
          hex: thread.hex ?? "",
        }}
        submitLabel="Zapisz zmiany"
        cancelHref={`/nici/${thread.id}`}
      />
    </div>
  );
}
