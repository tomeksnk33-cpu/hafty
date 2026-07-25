import Link from "next/link";

import { PageHeader, Stat } from "@/components/page-header";
import { RealizationCard, realizationCardSelect } from "@/components/realization-card";
import { prisma } from "@/lib/db";
import { formatMoney, plural } from "@/lib/format";

// Bez tego Next sprerenderowałby pulpit w czasie builda i liczniki zamroziłyby
// się na stanie bazy sprzed wdrożenia. Pozostałe strony są dynamiczne same z
// siebie, bo czytają `searchParams` albo `params`.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [realizationCount, clientCount, threadCount, totals, recent] = await Promise.all([
    prisma.realization.count(),
    prisma.client.count(),
    prisma.thread.count(),
    prisma.realization.aggregate({ _sum: { quantity: true } }),
    prisma.realization.findMany({
      orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: realizationCardSelect,
    }),
  ]);

  // Wartość liczymy w JS, bo to iloczyn dwóch kolumn — Prisma nie zsumuje go
  // jednym `aggregate`. Przy tej skali danych jest to bez znaczenia.
  const priced = await prisma.realization.findMany({
    where: { unitPriceGr: { not: null } },
    select: { unitPriceGr: true, quantity: true },
  });

  const revenue = priced.reduce((sum, row) => sum + (row.unitPriceGr ?? 0) * row.quantity, 0);

  return (
    <>
      <PageHeader
        title="Pulpit"
        subtitle="Skrót tego, co jest w bazie."
        action={
          <Link href="/realizacje/nowa" className="btn-primary">
            Dodaj realizację
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realizacje" value={realizationCount} />
        <Stat label="Wykonane sztuki" value={totals._sum.quantity ?? 0} />
        <Stat label="Klienci" value={clientCount} />
        <Stat label="Wartość" value={formatMoney(revenue)} />
      </div>

      <p className="mt-3 text-sm text-muted">
        <Link href="/podsumowania" className="text-accent hover:underline">
          Rozbicie na miesiące
        </Link>{" "}
        — ile haftów i za jaką kwotę w każdym miesiącu.
      </p>

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
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((realization) => (
              <RealizationCard key={realization.id} realization={realization} />
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
