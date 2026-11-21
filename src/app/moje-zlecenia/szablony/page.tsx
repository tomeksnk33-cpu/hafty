import Link from "next/link";

import { TemplateSearch } from "@/components/template-search";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { templateItem } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Szablony klienta do edycji. Zamawia się z kafelków na „Moje zlecenia”. */
export default async function MyTemplatesPage(props: PageProps<"/moje-zlecenia/szablony">) {
  const user = await requireClient();
  const search = await props.searchParams;

  const templates = await prisma.orderTemplate.findMany({
    where: { clientId: user.clientId },
    orderBy: { name: "asc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Moje szablony</h1>
          <p className="mt-1 text-sm text-muted">
            Szablon to gotowe zlecenie bez ilości. Przy zamówieniu z szablonu podajesz tylko ilość.
          </p>
        </div>
        <Link href="/moje-zlecenia/szablony/nowy" className="btn-primary px-6 py-4 text-lg">
          + Nowy szablon
        </Link>
      </div>

      {search.zapisano ? (
        <p role="status" className="card mb-4 border-[#86efac] bg-[#f0fdf4] px-5 py-3">
          ✓ Szablon zapisany. Znajdziesz go w „Zamów z szablonu” na liście zleceń.
        </p>
      ) : null}

      {templates.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-lg font-medium">Nie masz jeszcze szablonów.</p>
          <p className="mt-1 text-muted">
            Utwórz szablon albo przy złożonym zleceniu kliknij „Zapisz jako szablon”.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">Kliknij szablon, żeby go zmienić albo usunąć.</p>
          <TemplateSearch
            variant="tiles"
            templates={templates.map((template) => templateItem(template, `/moje-zlecenia/szablony/${template.id}`))}
          />
        </>
      )}
    </>
  );
}
