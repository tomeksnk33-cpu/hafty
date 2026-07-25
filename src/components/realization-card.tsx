import Image from "next/image";
import Link from "next/link";

import { formatDateShort, formatMoney } from "@/lib/format";

export type RealizationCardData = {
  id: string;
  name: string;
  executedAt: Date;
  quantity: number;
  unitPriceGr: number | null;
  client: { id: string; name: string } | null;
  photos: { url: string }[];
};

export function RealizationCard({
  realization,
  showClient = true,
}: {
  realization: RealizationCardData;
  showClient?: boolean;
}) {
  const cover = realization.photos[0];
  const total =
    realization.unitPriceGr === null ? null : realization.unitPriceGr * realization.quantity;

  return (
    <Link
      href={`/realizacje/${realization.id}`}
      className="card group overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-4/3 bg-paper">
        {cover ? (
          <Image
            src={cover.url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            bez zdjęcia
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="font-medium group-hover:text-accent">{realization.name}</p>

        <p className="mt-0.5 text-sm text-muted">
          {formatDateShort(realization.executedAt)}
          {showClient && realization.client ? ` · ${realization.client.name}` : ""}
        </p>

        <p className="mt-2 text-sm">
          {realization.quantity} szt.
          {total === null ? "" : ` · ${formatMoney(total)}`}
        </p>
      </div>
    </Link>
  );
}

/** Wspólny kształt danych dla kafelków — używany w kilku zapytaniach. */
export const realizationCardSelect = {
  id: true,
  name: true,
  executedAt: true,
  quantity: true,
  unitPriceGr: true,
  client: { select: { id: true, name: true } },
  photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
} as const;
