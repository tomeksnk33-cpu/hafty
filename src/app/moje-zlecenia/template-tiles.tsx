import { TemplateSearch } from "@/components/template-search";
import { prisma } from "@/lib/db";
import { templateItem } from "@/lib/orders";

/** Kafelki szablonów klienta z wyszukiwarką — wybór prowadzi do wpisania samej ilości. */
export async function TemplateTiles({ clientId }: { clientId: string }) {
  const templates = await prisma.orderTemplate.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      logos: { orderBy: { position: "asc" }, select: { kind: true, placement: true, description: true } },
    },
  });

  if (templates.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold">Zamów z szablonu</h2>
      <p className="mb-3 text-sm text-muted">Wybierz szablon i podaj tylko ilość.</p>
      <TemplateSearch
        variant="tiles"
        templates={templates.map((template) => templateItem(template, `/moje-zlecenia/szablon/${template.id}`))}
      />
    </section>
  );
}
