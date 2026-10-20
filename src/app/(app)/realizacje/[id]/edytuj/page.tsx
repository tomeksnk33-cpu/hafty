import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/format";

import { updateRealization } from "../../actions";
import { loadFormOptions } from "../../form-options";
import { RealizationForm } from "../../realization-form";

export default async function EditRealizationPage(
  props: PageProps<"/realizacje/[id]/edytuj">,
) {
  const user = await requireManager();
  const { id } = await props.params;

  const [realization, { clients, productTypes }] = await Promise.all([
    prisma.realization.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { position: "asc" },
          include: { markers: { select: { threadId: true, x: true, y: true } } },
        },
        designFiles: { orderBy: { createdAt: "asc" } },
        threads: {
          // Kolejność decyduje o numerach nici na znacznikach.
          orderBy: { position: "asc" },
          include: {
            thread: {
              select: { id: true, brand: true, number: true, colorName: true, hex: true },
            },
          },
        },
      },
    }),
    loadFormOptions(),
  ]);

  if (!realization) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edycja realizacji" subtitle={realization.name} />
      <RealizationForm
        action={updateRealization.bind(null, realization.id)}
        defaults={{
          name: realization.name,
          executedAt: toDateInputValue(realization.executedAt),
          clientId: realization.clientId ?? "",
          productType: realization.productType ?? "",
          widthMm: realization.widthMm?.toString() ?? "",
          heightMm: realization.heightMm?.toString() ?? "",
          stitchCount: realization.stitchCount?.toString() ?? "",
          quantity: realization.quantity.toString(),
          // Cena trafia do przeglądarki tylko wtedy, gdy osoba ma ją widzieć —
          // wartości propsów komponentu klienckiego są widoczne w kodzie strony.
          unitPriceGr:
            !user.canSeeMoney || realization.unitPriceGr === null
              ? ""
              : (realization.unitPriceGr / 100).toFixed(2).replace(".", ","),
          notes: realization.notes ?? "",
          threads: realization.threads.map((link) => link.thread),
          photos: realization.photos.map((photo) => ({
            url: photo.url,
            pathname: photo.pathname,
            filename: photo.pathname,
            sizeBytes: 0,
          })),
          designFiles: realization.designFiles.map((file) => ({
            url: file.url,
            pathname: file.pathname,
            filename: file.filename,
            sizeBytes: file.sizeBytes,
          })),
          markers: realization.photos.flatMap((photo) =>
            photo.markers.map((marker) => ({
              photo: photo.pathname,
              thread: marker.threadId,
              x: marker.x,
              y: marker.y,
            })),
          ),
        }}
        clients={clients}
        productTypes={productTypes}
        submitLabel="Zapisz zmiany"
        cancelHref={`/realizacje/${realization.id}`}
        showPrice={user.canSeeMoney}
      />
    </div>
  );
}
