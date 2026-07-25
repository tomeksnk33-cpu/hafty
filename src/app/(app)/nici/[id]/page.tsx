import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { RealizationCard, realizationCardSelect } from "@/components/realization-card";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";

import { deleteThread } from "../actions";

export default async function ThreadPage(props: PageProps<"/nici/[id]">) {
  const { id } = await props.params;

  const thread = await prisma.thread.findUnique({ where: { id } });

  if (!thread) notFound();

  const realizations = await prisma.realization.findMany({
    where: { threads: { some: { threadId: id } } },
    orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
    select: realizationCardSelect,
  });

  return (
    <>
      <PageHeader
        title={`${thread.brand} ${thread.number}`}
        subtitle={thread.colorName ?? undefined}
        action={
          <Link href={`/nici/${thread.id}/edytuj`} className="btn-secondary">
            Edytuj
          </Link>
        }
      />

      {thread.hex ? (
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden
            className="size-10 rounded-lg border border-line"
            style={{ backgroundColor: thread.hex }}
          />
          <span className="text-sm text-muted">{thread.hex}</span>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Użyta w {realizations.length}{" "}
          {plural(realizations.length, "realizacji", "realizacjach", "realizacjach")}
        </h2>

        {realizations.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-muted">
            Ta nić nie jest jeszcze przypisana do żadnej realizacji.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realizations.map((realization) => (
              <RealizationCard key={realization.id} realization={realization} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <DeleteButton
          action={deleteThread.bind(null, thread.id)}
          label="Usuń nić z katalogu"
          confirmText={`Usunąć nić ${thread.brand} ${thread.number}? Zniknie z ${realizations.length} ${plural(realizations.length, "realizacji", "realizacji", "realizacji")}, ale same realizacje zostaną.`}
        />
      </div>
    </>
  );
}
