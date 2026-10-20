import Link from "next/link";

import { MonthNav } from "@/components/month-nav";
import { EmptyState, PageHeader, Stat } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { parseMonth } from "@/lib/work-entries";

type UserRow = {
  /** Sztuki w poszczególne dni miesiąca, indeksowane numerem dnia (1–31). */
  perDay: Map<number, number>;
  entries: number;
  pieces: number;
};

const WEEKDAY_SHORT = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];

export default async function SettlementsPage(props: PageProps<"/rozliczenia">) {
  await requireAdmin();

  const { miesiac } = await props.searchParams;
  const range = parseMonth(miesiac);

  const grouped = await prisma.workEntry.groupBy({
    by: ["userId", "workDate"],
    where: { workDate: { gte: range.start, lt: range.end } },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  const rows = new Map<string, UserRow>();

  for (const group of grouped) {
    const row = rows.get(group.userId) ?? { perDay: new Map(), entries: 0, pieces: 0 };
    const pieces = group._sum.quantity ?? 0;

    row.perDay.set(group.workDate.getUTCDate(), pieces);
    row.entries += group._count._all;
    row.pieces += pieces;

    rows.set(group.userId, row);
  }

  // Wszyscy aktywni (żeby widać było, kto nic nie wpisał) oraz osoby wyłączone,
  // które mają wpisy w tym miesiącu.
  const users = await prisma.user.findMany({
    where: { OR: [{ active: true }, { id: { in: [...rows.keys()] } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, login: true, active: true },
  });

  const daysInMonth = new Date(Date.UTC(range.year, range.month + 1, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const weekday = new Date(Date.UTC(range.year, range.month, day)).getUTCDay();

    return { day, weekday, weekend: weekday === 0 || weekday === 6 };
  });

  const totalPieces = [...rows.values()].reduce((sum, row) => sum + row.pieces, 0);
  const totalEntries = [...rows.values()].reduce((sum, row) => sum + row.entries, 0);
  const dayTotals = days.map(({ day }) =>
    [...rows.values()].reduce((sum, row) => sum + (row.perDay.get(day) ?? 0), 0),
  );

  const withEntries = rows.size;

  return (
    <>
      <PageHeader
        title="Rozliczenia pracowników"
        subtitle="Kto, którego dnia i ile sztuk zrobił — na podstawie dzienników pracy."
      />

      <MonthNav range={range} basePath="/rozliczenia" />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Pracowali" value={`${withEntries} z ${users.length}`} />
        <Stat label="Wpisy" value={totalEntries} />
        <Stat label="Sztuki" value={totalPieces} />
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="Nie ma jeszcze pracowników."
          hint="Dodaj konta w zakładce Pracownicy, a ich wpisy pojawią się tutaj."
          action={
            <Link href="/pracownicy/nowy" className="btn-primary">
              Dodaj pracownika
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Sztuki wykonane przez każdego pracownika w kolejnych dniach miesiąca
            </caption>

            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-40 bg-surface px-3 py-2 text-left font-medium"
                >
                  Pracownik
                </th>

                {days.map(({ day, weekday, weekend }) => (
                  <th
                    key={day}
                    scope="col"
                    className={`min-w-9 px-1 py-2 text-center font-normal ${
                      weekend ? "bg-paper" : ""
                    }`}
                  >
                    <span className="block text-[10px] uppercase">{WEEKDAY_SHORT[weekday]}</span>
                    {day}
                  </th>
                ))}

                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Wpisy
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Sztuki
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {users.map((user) => {
                const row = rows.get(user.id);
                const detail = `/rozliczenia/${user.id}?miesiac=${range.key}`;

                return (
                  <tr key={user.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-normal"
                    >
                      <Link href={detail} className="font-medium hover:text-accent hover:underline">
                        {user.name}
                      </Link>
                      <span className="block text-xs text-muted">
                        {user.login}
                        {user.active ? "" : " · wyłączone"}
                      </span>
                    </th>

                    {days.map(({ day, weekend }) => {
                      const pieces = row?.perDay.get(day);

                      return (
                        <td
                          key={day}
                          className={`px-1 py-2 text-center tabular-nums ${
                            weekend ? "bg-paper" : ""
                          }`}
                        >
                          {pieces === undefined ? (
                            <span className="text-line">·</span>
                          ) : (
                            <Link
                              href={`${detail}#dzien-${range.key}-${String(day).padStart(2, "0")}`}
                              className="font-medium text-accent hover:underline"
                              title={`${user.name}, ${day}.${String(range.month + 1).padStart(2, "0")}`}
                            >
                              {pieces}
                            </Link>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-right tabular-nums">{row?.entries ?? 0}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {row?.pieces ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left">
                  Razem
                </th>
                {dayTotals.map((total, index) => (
                  <td key={days[index].day} className="px-1 py-2 text-center tabular-nums">
                    {total === 0 ? <span className="font-normal text-line">·</span> : total}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{totalEntries}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalPieces}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-sm text-muted">
        Kliknij nazwisko, żeby zobaczyć wpisy pracownika z całego miesiąca, albo liczbę w
        tabeli, żeby przejść do tego dnia. {totalEntries}{" "}
        {plural(totalEntries, "wpis", "wpisy", "wpisów")} w tym miesiącu.
      </p>
    </>
  );
}
