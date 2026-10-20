import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-header";
import { SearchField } from "@/components/search-field";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export default async function ClientsPage(props: PageProps<"/klienci">) {
  await requireManager();

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const where: Prisma.ClientWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { company: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      _count: { select: { realizations: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Klienci"
        subtitle={`${clients.length} ${plural(clients.length, "klient", "klientów", "klientów")}${
          query ? " pasujących do wyszukiwania" : ""
        }`}
        action={
          <Link href="/klienci/nowy" className="btn-primary">
            Dodaj klienta
          </Link>
        }
      />

      <div className="mb-5 max-w-md">
        <SearchField
          placeholder="Szukaj po nazwie, firmie, telefonie lub e-mailu"
          defaultValue={query}
        />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title={query ? "Brak klientów pasujących do wyszukiwania." : "Nie ma jeszcze klientów."}
          hint={
            query
              ? "Spróbuj wpisać krótszą frazę."
              : "Dodaj pierwszego klienta, żeby móc przypisywać mu realizacje."
          }
          action={
            query ? null : (
              <Link href="/klienci/nowy" className="btn-primary">
                Dodaj klienta
              </Link>
            )
          }
        />
      ) : (
        <ul className="card divide-y divide-line">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/klienci/${client.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-paper"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.name}</p>
                  <p className="truncate text-sm text-muted">
                    {[client.company, client.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>

                <span className="shrink-0 text-sm text-muted">
                  {client._count.realizations}{" "}
                  {plural(
                    client._count.realizations,
                    "realizacja",
                    "realizacje",
                    "realizacji",
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
