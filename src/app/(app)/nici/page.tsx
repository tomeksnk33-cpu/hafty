import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-header";
import { SearchField } from "@/components/search-field";
import { requireEmbroideryUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export default async function ThreadsPage(props: PageProps<"/nici">) {
  const user = await requireEmbroideryUser();
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const where: Prisma.ThreadWhereInput = query
    ? {
        OR: [
          { number: { contains: query, mode: "insensitive" } },
          { colorName: { contains: query, mode: "insensitive" } },
          { brand: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const threads = await prisma.thread.findMany({
    where,
    orderBy: [{ brand: "asc" }, { number: "asc" }],
    select: {
      id: true,
      brand: true,
      number: true,
      colorName: true,
      hex: true,
      _count: { select: { realizations: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Katalog nici"
        subtitle={`${threads.length} ${plural(threads.length, "nić", "nici", "nici")}${
          query ? " pasujących do wyszukiwania" : ""
        }`}
        action={
          user.canManage ? (
            <Link href="/nici/nowa" className="btn-primary">
              Dodaj nić
            </Link>
          ) : undefined
        }
      />

      <div className="mb-5 max-w-md">
        <SearchField
          placeholder="Szukaj po numerze, nazwie koloru lub producencie"
          defaultValue={query}
        />
      </div>

      {threads.length === 0 ? (
        <EmptyState
          title={query ? "Brak nici pasujących do wyszukiwania." : "Katalog nici jest pusty."}
          hint={
            query
              ? "Spróbuj wpisać sam numer, np. 1147."
              : user.canManage
                ? "Dodaj nici, których używasz — potem będziesz je tylko wybierać przy realizacji."
                : "Nici dodaje administrator albo osoba z uprawnieniami."
          }
          action={
            query || !user.canManage ? null : (
              <Link href="/nici/nowa" className="btn-primary">
                Dodaj nić
              </Link>
            )
          }
        />
      ) : (
        <ul className="card divide-y divide-line">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/nici/${thread.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-paper"
              >
                <span
                  aria-hidden
                  className="size-6 shrink-0 rounded-full border border-line"
                  style={{ backgroundColor: thread.hex ?? "transparent" }}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {thread.brand} {thread.number}
                  </p>
                  <p className="truncate text-sm text-muted">{thread.colorName ?? "—"}</p>
                </div>

                <span className="shrink-0 text-sm text-muted">
                  {thread._count.realizations}{" "}
                  {plural(
                    thread._count.realizations,
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
