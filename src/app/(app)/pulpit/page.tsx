import Link from "next/link";

import { PageHeader, Stat } from "@/components/page-header";
import { RealizationCard, realizationCardSelect } from "@/components/realization-card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, plural, todayInputValue } from "@/lib/format";

// Bez tego Next sprerenderowałby pulpit w czasie builda i liczniki zamroziłyby
// się na stanie bazy sprzed wdrożenia. Pozostałe strony są dynamiczne same z
// siebie, bo czytają `searchParams` albo `params`.
export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/pulpit">) {
  const user = await requireUser();
  const { brak } = await props.searchParams;

  const today = new Date(`${todayInputValue()}T00:00:00.000Z`);

  const [realizationCount, clientCount, threadCount, totals, recent, mineToday] =
    await Promise.all([
      prisma.realization.count(),
      user.canManage ? prisma.client.count() : Promise.resolve(0),
      prisma.thread.count(),
      prisma.realization.aggregate({ _sum: { quantity: true } }),
      prisma.realization.findMany({
        orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
        take: 6,
        select: realizationCardSelect,
      }),
      prisma.workEntry.aggregate({
        where: { userId: user.id, workDate: today },
        _sum: { quantity: true },
        _count: true,
      }),
    ]);

  // Wartość liczymy w JS, bo to iloczyn dwóch kolumn — Prisma nie zsumuje go
  // jednym `aggregate`. Zapytanie wykonujemy tylko dla osoby, która widzi kwoty.
  let revenue = 0;

  if (user.canSeeMoney) {
    const priced = await prisma.realization.findMany({
      where: { unitPriceGr: { not: null } },
      select: { unitPriceGr: true, quantity: true },
    });

    revenue = priced.reduce((sum, row) => sum + (row.unitPriceGr ?? 0) * row.quantity, 0);
  }

  const loggedPieces = mineToday._sum.quantity ?? 0;

  return (
    <>
      {brak === "uprawnien" ? (
        <p role="alert" className="mb-6 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
          Nie masz uprawnień do tej strony. Jeśli jest Ci potrzebna, poproś administratora.
        </p>
      ) : null}

      <PageHeader
        title="Pulpit"
        subtitle={`Zalogowano jako ${user.name}.`}
        action={
          user.canManage ? (
            <Link href="/realizacje/nowa" className="btn-primary">
              Dodaj realizację
            </Link>
          ) : undefined
        }
      />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Twój dzień</p>
          <p className="mt-1 text-lg font-semibold">
            {mineToday._count === 0
              ? "Nie ma jeszcze wpisu na dziś"
              : `${loggedPieces} szt. w ${mineToday._count} ${plural(mineToday._count, "wpisie", "wpisach", "wpisach")}`}
          </p>
        </div>

        <Link href="/dziennik" className="btn-primary">
          {mineToday._count === 0 ? "Wpisz, co dziś zrobiłeś" : "Otwórz dziennik"}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realizacje" value={realizationCount} />
        <Stat label="Wykonane sztuki" value={totals._sum.quantity ?? 0} />
        {user.canManage ? <Stat label="Klienci" value={clientCount} /> : null}
        {user.canSeeMoney ? <Stat label="Wartość" value={formatMoney(revenue)} /> : null}
      </div>

      {user.isAdmin ? (
        <p className="mt-3 text-sm text-muted">
          <Link href="/podsumowania" className="text-accent hover:underline">
            Rozbicie na miesiące
          </Link>{" "}
          — ile haftów i za jaką kwotę w każdym miesiącu.{" "}
          <Link href="/rozliczenia" className="text-accent hover:underline">
            Rozliczenia pracowników
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Ostatnie realizacje</h2>
          <Link href="/realizacje" className="text-sm text-accent hover:underline">
            Zobacz całą historię
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="font-medium">Nie ma jeszcze żadnej realizacji.</p>

            {user.canManage ? (
              <>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                  Zacznij od dodania klienta i nici, a potem zapisz pierwszy haft.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/klienci/nowy" className="btn-secondary">
                    Dodaj klienta
                  </Link>
                  <Link href="/realizacje/nowa" className="btn-primary">
                    Dodaj realizację
                  </Link>
                </div>
              </>
            ) : (
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Hafty dodaje administrator albo osoba z uprawnieniami.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((realization) => (
              <RealizationCard
                key={realization.id}
                realization={realization}
                showPrice={user.canSeeMoney}
              />
            ))}
          </div>
        )}
      </section>

      {threadCount > 0 ? (
        <p className="mt-8 text-sm text-muted">
          W katalogu {threadCount} {plural(threadCount, "nić", "nici", "nici")}.{" "}
          <Link href="/nici" className="text-accent hover:underline">
            Przejdź do katalogu
          </Link>
        </p>
      ) : null}
    </>
  );
}
