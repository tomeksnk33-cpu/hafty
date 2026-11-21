import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { ORDER_KIND_LABEL, placementText } from "@/lib/orders";

/** Kafelki szablonów klienta — wybór szablonu prowadzi do wpisania samej ilości. */
export async function TemplateTiles({ clientId }: { clientId: string }) {
  const templates = await prisma.orderTemplate.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });

  if (templates.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold">Zamów z szablonu</h2>
      <p className="mb-3 text-sm text-muted">Wybierz szablon i podaj tylko ilość.</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {templates.map((template) => (
          <li key={template.id}>
            <Link
              href={`/moje-zlecenia/szablon/${template.id}`}
              className="card flex h-full flex-col overflow-hidden transition-colors hover:border-accent/40"
            >
              <span className="relative block aspect-[4/3] bg-paper">
                {template.photos[0] ? (
                  <Image src={template.photos[0].url} alt="" fill sizes="300px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-3xl text-muted">
                    {template.kind === "DTF" ? "DTF" : "🧵"}
                  </span>
                )}
              </span>
              <span className="block p-3">
                <span className="block text-lg leading-snug font-semibold">{template.name}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {ORDER_KIND_LABEL[template.kind]} · {placementText(template.placements, template.placementNotes)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
