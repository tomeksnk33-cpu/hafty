import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { requireEmbroideryUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, todayInputValue } from "@/lib/format";
import { canChangeEntryOn, oldestEditableDate, safeReturnPath } from "@/lib/work-entries";

import { updateWorkEntry } from "../../actions";
import { loadRealizationOptions } from "../../realization-options";
import { WorkEntryForm } from "../../work-entry-form";

export default async function EditWorkEntryPage(props: PageProps<"/dziennik/[id]/edytuj">) {
  const user = await requireEmbroideryUser();
  const { id } = await props.params;
  const { wroc } = await props.searchParams;

  const entry = await prisma.workEntry.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });

  if (!entry) notFound();

  const workDate = entry.workDate.toISOString().slice(0, 10);

  // Sprawdzenie przy samym wejściu — adres edycji da się wpisać ręcznie.
  if (!canChangeEntryOn(user, { userId: entry.userId, workDate })) {
    redirect("/dziennik");
  }

  const returnTo = safeReturnPath(wroc);
  const today = todayInputValue();
  const options = await loadRealizationOptions(entry.realizationId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edycja wpisu"
        subtitle={`${entry.user.name} · ${formatDate(entry.workDate)}`}
      />

      <div className="card p-5">
        <WorkEntryForm
          action={updateWorkEntry.bind(null, entry.id, returnTo)}
          defaults={{
            workDate,
            realizationId: entry.realizationId ?? "",
            quantity: String(entry.quantity),
            notes: entry.notes ?? "",
          }}
          realizations={options}
          submitLabel="Zapisz zmiany"
          cancelHref={returnTo}
          minDate={user.isAdmin ? undefined : oldestEditableDate(today)}
          maxDate={today}
          orphanLabel={
            entry.realizationId === null
              ? `${entry.realizationName} (realizacja usunięta)`
              : undefined
          }
        />
      </div>
    </div>
  );
}
