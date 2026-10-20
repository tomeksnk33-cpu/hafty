import Link from "next/link";

import { PageHeader, Stat } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, monthName, plural } from "@/lib/format";

type MonthRow = {
  month: number;
  count: number;
  pieces: number;
  value: number;
  withoutPrice: number;
};

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Zakres dat miesiąca w formacie, jakiego oczekują filtry historii realizacji. */
function monthRange(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { od: isoDay(year, month, 1), do: isoDay(year, month, lastDay) };
}

export default async function MonthlySummaryPage(props: PageProps<"/podsumowania">) {
  await requireAdmin();

  const { rok } = await props.searchParams;

  const [oldest, newest] = await Promise.all([
    prisma.realization.findFirst({
      orderBy: { executedAt: "asc" },
      select: { executedAt: true },
    }),
    prisma.realization.findFirst({
      orderBy: { executedAt: "desc" },
      select: { executedAt: true },
    }),
  ]);

  const currentYear = new Date().getUTCFullYear();

  // Lista lat do przełącznika: od najstarszej realizacji do najnowszej,
  // zawsze z bieżącym rokiem, żeby dało się wejść na pusty, świeży rok.
  const firstYear = Math.min(oldest?.executedAt.getUTCFullYear() ?? currentYear, currentYear);
  const lastYear = Math.max(newest?.executedAt.getUTCFullYear() ?? currentYear, currentYear);

  const years: number[] = [];
  for (let year = lastYear; year >= firstYear; year -= 1) years.push(year);

  const requested = Number.parseInt(typeof rok === "string" ? rok : "", 10);
  const year = years.includes(requested) ? requested : lastYear;

  const realizations = await prisma.realization.findMany({
    where: {
      executedAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: { executedAt: true, quantity: true, unitPriceGr: true },
  });

  const months: MonthRow[] = Array.from({ length: 12 }, (_, month) => ({
    month,
    count: 0,
    pieces: 0,
    value: 0,
    withoutPrice: 0,
  }));

  for (const realization of realizations) {
    // Kolumna jest typu DATE, więc wraca jako północ UTC — miesiąc czytamy w UTC,
    // żeby grudniowa realizacja nie wpadła do stycznia.
    const row = months[realization.executedAt.getUTCMonth()];

    row.count += 1;
    row.pieces += realization.quantity;

    if (realization.unitPriceGr === null) {
      row.withoutPrice += 1;
    } else {
      row.value += realization.unitPriceGr * realization.quantity;
    }
  }

  const totals = months.reduce(
    (sum, row) => ({
      count: sum.count + row.count,
      pieces: sum.pieces + row.pieces,
      value: sum.value + row.value,
      withoutPrice: sum.withoutPrice + row.withoutPrice,
    }),
    { count: 0, pieces: 0, value: 0, withoutPrice: 0 },
  );

  const best = Math.max(...months.map((row) => row.value));

  return (
    <>
      <PageHeader
        title="Podsumowanie miesięczne"
        subtitle="Wartość wykonanych haftów w rozbiciu na miesiące."
      />

      {years.length > 1 ? (
        <nav aria-label="Wybór roku" className="mb-6 flex flex-wrap gap-2">
          {years.map((option) => (
            <Link
              key={option}
              href={option === lastYear ? "/podsumowania" : `/podsumowania?rok=${option}`}
              aria-current={option === year ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                option === year
                  ? "bg-accent-soft text-accent"
                  : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Realizacje w ${year}`} value={totals.count} />
        <Stat label="Wykonane sztuki" value={totals.pieces} />
        <Stat label="Wartość roku" value={formatMoney(totals.value)} />
        <Stat
          label="Średnio na miesiąc"
          value={formatMoney(Math.round(totals.value / 12))}
        />
      </div>

      {totals.count === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center">
          <p className="font-medium">W {year} roku nie ma jeszcze żadnej realizacji.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Podsumowanie wypełni się samo, gdy dodasz hafty z datą wykonania w tym roku.
          </p>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">
              Realizacje, sztuki i wartość w kolejnych miesiącach {year} roku
            </caption>

            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <th scope="col" className="px-4 py-2 font-medium">
                  Miesiąc
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Realizacje
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Sztuki
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Wartość
                </th>
                <th scope="col" className="w-1/4 px-4 py-2 font-medium">
                  <span className="sr-only">Udział w roku</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {months.map((row) => {
                const range = monthRange(year, row.month);
                const empty = row.count === 0;

                return (
                  <tr key={row.month} className={empty ? "text-muted" : undefined}>
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {empty ? (
                        <span className="capitalize">{monthName(row.month)}</span>
                      ) : (
                        <Link
                          href={`/realizacje?od=${range.od}&do=${range.do}`}
                          className="capitalize hover:text-accent hover:underline"
                        >
                          {monthName(row.month)}
                        </Link>
                      )}
                      {row.withoutPrice > 0 ? (
                        <span className="block text-xs text-muted">
                          w tym {row.withoutPrice} bez ceny
                        </span>
                      ) : null}
                    </th>

                    <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.pieces}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {row.value === 0 && empty ? "—" : formatMoney(row.value)}
                    </td>

                    <td className="px-4 py-2">
                      <div
                        aria-hidden
                        className="h-2 rounded-full bg-paper"
                        title={formatMoney(row.value)}
                      >
                        <div
                          className="h-2 rounded-full bg-accent"
                          style={{ width: best > 0 ? `${(row.value / best) * 100}%` : "0%" }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <th scope="row" className="px-4 py-3 text-left">
                  Razem {year}
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{totals.count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.pieces}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(totals.value)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {totals.withoutPrice > 0 ? (
        <p className="mt-3 text-sm text-muted">
          Bez wpisanej ceny: {totals.withoutPrice}{" "}
          {plural(totals.withoutPrice, "realizacja", "realizacje", "realizacji")} —{" "}
          {plural(totals.withoutPrice, "nie wchodzi", "nie wchodzą", "nie wchodzą")} do
          wartości roku.
        </p>
      ) : null}
    </>
  );
}
