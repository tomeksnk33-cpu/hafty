import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/delete-button";
import { PageHeader, Stat } from "@/components/page-header";
import { RealizationCard, realizationCardSelect } from "@/components/realization-card";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, plural } from "@/lib/format";

import { deleteClient } from "../actions";

export default async function ClientSummaryPage(props: PageProps<"/klienci/[id]">) {
  const { id } = await props.params;

  const client = await prisma.client.findUnique({ where: { id } });

  if (!client) notFound();

  const [realizations, topThreadCounts] = await Promise.all([
    prisma.realization.findMany({
      where: { clientId: id },
      orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
      select: { ...realizationCardSelect, executedAt: true },
    }),
    prisma.realizationThread.groupBy({
      by: ["threadId"],
      where: { realization: { clientId: id } },
      _count: { threadId: true },
      orderBy: { _count: { threadId: "desc" } },
      take: 6,
    }),
  ]);

  const threads = await prisma.thread.findMany({
    where: { id: { in: topThreadCounts.map((row) => row.threadId) } },
    select: { id: true, brand: true, number: true, colorName: true, hex: true },
  });

  // groupBy zwraca kolejność wg liczby użyć, findMany jej nie zachowuje.
  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  const topThreads = topThreadCounts
    .map((row) => ({ thread: threadById.get(row.threadId), uses: row._count.threadId }))
    .filter((row) => row.thread !== undefined);

  const pieces = realizations.reduce((sum, row) => sum + row.quantity, 0);
  const value = realizations.reduce(
    (sum, row) => sum + (row.unitPriceGr ?? 0) * row.quantity,
    0,
  );

  const dates = realizations.map((row) => row.executedAt);
  const first = dates.at(-1);
  const last = dates.at(0);

  const contact = [client.company, client.phone, client.email].filter(Boolean);

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={contact.length > 0 ? contact.join(" · ") : undefined}
        action={
          <div className="flex gap-2">
            <Link
              href={`/realizacje/nowa?klient=${client.id}`}
              className="btn-primary"
            >
              Dodaj realizację
            </Link>
            <Link href={`/klienci/${client.id}/edytuj`} className="btn-secondary">
              Edytuj
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realizacje" value={realizations.length} />
        <Stat label="Sztuki" value={pieces} />
        <Stat label="Wartość" value={formatMoney(value)} />
        <Stat
          label="Okres współpracy"
          value={
            first && last ? (
              <span className="text-sm font-medium">
                {formatDate(first)}
                {first.getTime() === last.getTime() ? "" : ` – ${formatDate(last)}`}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted">—</span>
            )
          }
        />
      </div>

      {client.notes ? (
        <div className="card mt-6 p-4">
          <h2 className="mb-1 text-sm font-medium">Notatki</h2>
          <p className="text-sm whitespace-pre-wrap text-muted">{client.notes}</p>
        </div>
      ) : null}

      {topThreads.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Najczęściej używane nici</h2>
          <ul className="flex flex-wrap gap-2">
            {topThreads.map(({ thread, uses }) => (
              <li key={thread!.id}>
                <Link href={`/nici/${thread!.id}`} className="chip hover:border-accent/40">
                  {thread!.hex ? (
                    <span
                      aria-hidden
                      className="size-3 rounded-full border border-line"
                      style={{ backgroundColor: thread!.hex }}
                    />
                  ) : null}
                  {thread!.brand} {thread!.number}
                  {thread!.colorName ? ` · ${thread!.colorName}` : ""}
                  <span className="text-muted">
                    ×{uses}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          Realizacje{" "}
          <span className="text-sm font-normal text-muted">
            ({realizations.length}{" "}
            {plural(realizations.length, "pozycja", "pozycje", "pozycji")} w historii)
          </span>
        </h2>

        {realizations.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-medium">Ten klient nie ma jeszcze realizacji.</p>
            <Link
              href={`/realizacje/nowa?klient=${client.id}`}
              className="btn-primary mt-4"
            >
              Dodaj pierwszą realizację
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realizations.map((realization) => (
              <RealizationCard
                key={realization.id}
                realization={realization}
                showClient={false}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <DeleteButton
          action={deleteClient.bind(null, client.id)}
          label="Usuń klienta"
          confirmText={`Usunąć klienta „${client.name}”? Jego realizacje zostaną w bazie, ale stracą przypisanie do klienta.`}
        />
        <p className="mt-2 text-xs text-muted">
          Realizacje nie są usuwane razem z klientem — zostają w historii bez przypisania.
        </p>
      </div>
    </>
  );
}
