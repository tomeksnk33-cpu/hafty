import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-header";
import { RealizationCard, realizationCardSelect } from "@/components/realization-card";
import { requireEmbroideryUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, plural } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

import { RealizationFilters } from "./filters";

const PAGE_SIZE = 24;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

/** `<input type="date">` daje "RRRR-MM-DD"; puste albo błędne pole ignorujemy. */
function toUtcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function RealizationsPage(props: PageProps<"/realizacje">) {
  const user = await requireEmbroideryUser();
  const searchParams = await props.searchParams;

  const values = {
    q: one(searchParams.q),
    klient: one(searchParams.klient),
    nic: one(searchParams.nic),
    typ: one(searchParams.typ),
    od: one(searchParams.od),
    do: one(searchParams.do),
  };

  const page = Math.max(1, Number.parseInt(one(searchParams.strona) || "1", 10) || 1);

  const conditions: Prisma.RealizationWhereInput[] = [];

  if (values.q) {
    conditions.push({
      OR: [
        { name: { contains: values.q, mode: "insensitive" } },
        { productType: { contains: values.q, mode: "insensitive" } },
        { client: { name: { contains: values.q, mode: "insensitive" } } },
        { client: { company: { contains: values.q, mode: "insensitive" } } },
        {
          threads: {
            some: {
              thread: {
                OR: [
                  { number: { contains: values.q, mode: "insensitive" } },
                  { colorName: { contains: values.q, mode: "insensitive" } },
                  { brand: { contains: values.q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  if (values.klient) conditions.push({ clientId: values.klient });
  if (values.nic) conditions.push({ threads: { some: { threadId: values.nic } } });
  if (values.typ) conditions.push({ productType: values.typ });

  const from = toUtcDate(values.od);
  const until = toUtcDate(values.do);

  if (from) conditions.push({ executedAt: { gte: from } });
  if (until) conditions.push({ executedAt: { lte: until } });

  const where: Prisma.RealizationWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [total, realizations, matching, clients, threads, types] = await Promise.all([
    prisma.realization.count({ where }),
    prisma.realization.findMany({
      where,
      orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: realizationCardSelect,
    }),
    // Sumy dotyczą całego wyniku wyszukiwania, nie tylko bieżącej strony.
    prisma.realization.findMany({
      where,
      select: { quantity: true, unitPriceGr: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.thread.findMany({
      orderBy: [{ brand: "asc" }, { number: "asc" }],
      select: { id: true, brand: true, number: true, colorName: true },
    }),
    prisma.realization.findMany({
      where: { productType: { not: null } },
      distinct: ["productType"],
      orderBy: { productType: "asc" },
      select: { productType: true },
    }),
  ]);

  const pieces = matching.reduce((sum, row) => sum + row.quantity, 0);
  const value = matching.reduce(
    (sum, row) => sum + (row.unitPriceGr ?? 0) * row.quantity,
    0,
  );

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(values).some(Boolean);

  function pageHref(target: number) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }

    if (target > 1) params.set("strona", String(target));

    const query = params.toString();
    return query ? `/realizacje?${query}` : "/realizacje";
  }

  return (
    <>
      <PageHeader
        title="Historia realizacji"
        subtitle={
          total === 0
            ? "Brak wyników"
            : `${total} ${plural(total, "realizacja", "realizacje", "realizacji")} · ${pieces} szt.${
                user.canSeeMoney ? ` · ${formatMoney(value)}` : ""
              }`
        }
        action={
          user.canManage ? (
            <Link href="/realizacje/nowa" className="btn-primary">
              Dodaj realizację
            </Link>
          ) : undefined
        }
      />

      <RealizationFilters
        options={{
          clients,
          threads,
          productTypes: types
            .map((row) => row.productType)
            .filter((type): type is string => Boolean(type)),
        }}
        values={values}
      />

      {realizations.length === 0 ? (
        <EmptyState
          title={filtered ? "Nic nie pasuje do tych filtrów." : "Nie ma jeszcze realizacji."}
          hint={
            filtered
              ? "Spróbuj skrócić frazę albo wyczyścić część filtrów."
              : user.canManage
                ? "Dodaj pierwszy haft — zdjęcie, datę, klienta i użyte nici."
                : "Hafty dodaje administrator albo osoba z uprawnieniami."
          }
          action={
            filtered || !user.canManage ? null : (
              <Link href="/realizacje/nowa" className="btn-primary">
                Dodaj realizację
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realizations.map((realization) => (
              <RealizationCard
                key={realization.id}
                realization={realization}
                showPrice={user.canSeeMoney}
              />
            ))}
          </div>

          {pages > 1 ? (
            <nav
              aria-label="Strony wyników"
              className="mt-8 flex items-center justify-center gap-3"
            >
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn-secondary">
                  Poprzednia
                </Link>
              ) : null}

              <span className="text-sm text-muted">
                Strona {page} z {pages}
              </span>

              {page < pages ? (
                <Link href={pageHref(page + 1)} className="btn-secondary">
                  Następna
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
