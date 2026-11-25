import Link from "next/link";

import { TemplateSearch } from "@/components/template-search";
import { prisma } from "@/lib/db";
import { LOGO_QUERY, templateItem } from "@/lib/orders";

/** Kafelki szablonów klienta z wyszukiwarką — wybór prowadzi do wpisania samej ilości. */
export async function TemplateTiles({ clientId }: { clientId: string }) {
  const templates = await prisma.orderTemplate.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      logos: LOGO_QUERY,
    },
  });

  if (templates.length === 0) {
    return (
      <p className="card mb-8 px-5 py-4 text-sm text-muted">
        Często zamawiasz to samo?{" "}
        <Link href="/moje-zlecenia/szablony/nowy" className="font-medium text-accent hover:underline">
          Utwórz szablon
        </Link>{" "}
        — potem zamówisz z niego, podając tylko ilość.
      </p>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Zamów z szablonu</h2>
        <Link href="/moje-zlecenia/szablony" className="text-sm font-medium text-accent hover:underline">
          Zarządzaj szablonami
        </Link>
      </div>
      <p className="mb-3 text-sm text-muted">Wybierz szablon i podaj tylko ilość.</p>
      <TemplateSearch
        variant="tiles"
        templates={templates.map((template) => templateItem(template, `/moje-zlecenia/szablon/${template.id}`))}
      />
    </section>
  );
}
