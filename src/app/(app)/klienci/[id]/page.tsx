import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/confirm-action";
import { DeleteButton } from "@/components/delete-button";
import { OrderStatusBadge } from "@/components/order-details";
import { TemplateSearch } from "@/components/template-search";
import { PageHeader, Stat } from "@/components/page-header";
import { RealizationCard, realizationCardSelect } from "@/components/realization-card";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { LOGO_QUERY, logosText, orderNumber, templateItem } from "@/lib/orders";

import { deleteClient, saveClientAccount, setClientAccountActive } from "../actions";
import { ClientAccountForm } from "./client-account";

export default async function ClientSummaryPage(props: PageProps<"/klienci/[id]">) {
  const user = await requireManager();
  const { id } = await props.params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      account: { select: { login: true, active: true } },
      templates: {
        orderBy: { name: "asc" },
        include: {
          photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          logos: LOGO_QUERY,
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          product: true,
          quantity: true,
          status: true,
          createdAt: true,
          logos: LOGO_QUERY,
        },
      },
    },
  });

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
        {user.canSeeMoney ? <Stat label="Wartość" value={formatMoney(value)} /> : null}
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

      <section className="card mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Konto do składania zleceń</h2>
            <p className="mt-1 text-sm text-muted">
              {client.account
                ? client.account.active
                  ? `Klient loguje się loginem „${client.account.login}” i widzi tylko swoje zlecenia.`
                  : `Konto „${client.account.login}” jest zablokowane — klient nie może się zalogować.`
                : "Klient nie ma jeszcze konta. Załóż je, żeby mógł sam składać zlecenia (haft lub DTF) ze zdjęciem asortymentu."}
            </p>
          </div>
          {client.account ? (
            client.account.active ? (
              <ConfirmAction
                action={setClientAccountActive.bind(null, client.id, false)}
                label="Zablokuj konto"
                title="Zablokować konto klienta?"
                text="Klient nie zaloguje się, dopóki konto nie zostanie odblokowane. Zlecenia zostają."
                confirmLabel="Tak, zablokuj"
                buttonClassName="btn-danger"
                danger
              />
            ) : (
              <ConfirmAction
                action={setClientAccountActive.bind(null, client.id, true)}
                label="Odblokuj konto"
                title="Odblokować konto klienta?"
                confirmLabel="Tak, odblokuj"
              />
            )
          ) : null}
        </div>

        <ClientAccountForm
          action={saveClientAccount.bind(null, client.id)}
          login={client.account?.login ?? ""}
          hasAccount={client.account !== null}
        />

        {client.orders.length > 0 ? (
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-medium">Zlecenia klienta</h3>
            <ul className="divide-y divide-line">
              {client.orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/zlecenia/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:text-accent"
                  >
                    <span>
                      {orderNumber(order.number)} · {formatDate(order.createdAt)} · {order.product} ×{" "}
                      {order.quantity} szt. · {logosText(order.logos)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section id="szablony" className="card mt-6 scroll-mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Szablony zleceń</h2>
            <p className="mt-1 text-sm text-muted">
              Gotowe zlecenia (asortyment ze zdjęciem, rodzaj, umiejscowienie, opis). Klient wybiera szablon i podaje
              tylko ilość.
            </p>
          </div>
          <Link href={`/klienci/${client.id}/szablony/nowy`} className="btn-primary">
            Dodaj szablon
          </Link>
        </div>

        {client.templates.length === 0 ? (
          <p className="text-sm text-muted">Ten klient nie ma jeszcze szablonów.</p>
        ) : (
          <TemplateSearch
            variant="list"
            templates={client.templates.map((template) =>
              templateItem(template, `/klienci/${client.id}/szablony/${template.id}`),
            )}
          />
        )}

        {client.account ? null : (
          <p className="mt-3 text-xs text-muted">Szablony zobaczy klient po założeniu mu konta.</p>
        )}
      </section>

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
                showPrice={user.canSeeMoney}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <DeleteButton
          action={deleteClient.bind(null, client.id)}
          label="Usuń klienta"
          confirmText={`Usunąć klienta „${client.name}”? Jego realizacje zostaną w bazie, ale stracą przypisanie do klienta. Konto klienta i jego zlecenia zostaną usunięte.`}
        />
        <p className="mt-2 text-xs text-muted">
          Realizacje nie są usuwane razem z klientem — zostają w historii bez przypisania.
        </p>
      </div>
    </>
  );
}
