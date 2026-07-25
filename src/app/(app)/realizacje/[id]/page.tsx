import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { RealizationGallery } from "@/components/realization-gallery";
import { prisma } from "@/lib/db";
import { formatDate, formatFileSize, formatMoney } from "@/lib/format";

import { deleteRealization } from "../actions";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

export default async function RealizationPage(props: PageProps<"/realizacje/[id]">) {
  const { id } = await props.params;

  const realization = await prisma.realization.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      photos: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          url: true,
          markers: { select: { id: true, threadId: true, x: true, y: true } },
        },
      },
      designFiles: { orderBy: { createdAt: "asc" } },
      threads: {
        // Kolejność wyboru wyznacza numery nici widoczne na znacznikach.
        orderBy: { position: "asc" },
        include: {
          thread: {
            select: { id: true, brand: true, number: true, colorName: true, hex: true },
          },
        },
      },
    },
  });

  if (!realization) notFound();

  const size =
    realization.widthMm && realization.heightMm
      ? `${realization.widthMm} × ${realization.heightMm} mm`
      : null;

  const total =
    realization.unitPriceGr === null
      ? null
      : realization.unitPriceGr * realization.quantity;

  return (
    <>
      <PageHeader
        title={realization.name}
        subtitle={formatDate(realization.executedAt)}
        action={
          <Link href={`/realizacje/${realization.id}/edytuj`} className="btn-secondary">
            Edytuj
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <RealizationGallery
          photos={realization.photos}
          threads={realization.threads.map((link) => link.thread)}
          alt={realization.name}
        />

        <div className="space-y-6">
          <div className="card px-4 py-2">
            <dl className="divide-y divide-line">
              <Row label="Klient">
                {realization.client ? (
                  <Link
                    href={`/klienci/${realization.client.id}`}
                    className="text-accent hover:underline"
                  >
                    {realization.client.name}
                  </Link>
                ) : (
                  <span className="text-muted">haft własny</span>
                )}
              </Row>

              <Row label="Data wykonania">{formatDate(realization.executedAt)}</Row>
              <Row label="Ilość sztuk">{realization.quantity}</Row>

              <Row label="Cena za sztukę">{formatMoney(realization.unitPriceGr)}</Row>
              <Row label="Wartość realizacji">{formatMoney(total)}</Row>

              <Row label="Typ produktu">
                {realization.productType ?? <span className="text-muted">—</span>}
              </Row>

              <Row label="Wymiary haftu">
                {size ?? <span className="text-muted">—</span>}
              </Row>

              <Row label="Liczba ściegów">
                {realization.stitchCount?.toLocaleString("pl-PL") ?? (
                  <span className="text-muted">—</span>
                )}
              </Row>
            </dl>
          </div>

          <section>
            <h2 className="mb-2 font-semibold">Pliki projektu</h2>
            {realization.designFiles.length === 0 ? (
              <p className="text-sm text-muted">Brak wgranych plików.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {realization.designFiles.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 px-3 py-2">
                    <a
                      href={file.url}
                      download={file.filename}
                      className="min-w-0 flex-1 truncate text-sm text-accent hover:underline"
                    >
                      {file.filename}
                    </a>
                    <span className="shrink-0 text-xs text-muted">
                      {formatFileSize(file.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {realization.notes ? (
            <section>
              <h2 className="mb-2 font-semibold">Notatki</h2>
              <p className="text-sm whitespace-pre-wrap text-muted">{realization.notes}</p>
            </section>
          ) : null}
        </div>
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <DeleteButton
          action={deleteRealization.bind(null, realization.id)}
          label="Usuń realizację"
          confirmText={`Usunąć realizację „${realization.name}”? Zdjęcia i pliki projektu również zostaną skasowane.`}
        />
      </div>
    </>
  );
}
