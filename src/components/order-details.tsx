import Image from "next/image";

import { formatDate } from "@/lib/format";
import {
  ORDER_KIND_SHORT,
  ORDER_PLACEMENT_LABEL,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  type OrderLogoData,
  type OrderStatusValue,
} from "@/lib/orders";

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${ORDER_STATUS_CLASS[status]}`}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export type OrderDetailsData = {
  product: string;
  logos: OrderLogoData[];
  /** `null` w podglądzie szablonu — ilość poda klient. */
  quantity: number | null;
  notes: string | null;
  createdAt: Date | null;
  photos: { id: string; url: string; filename: string }[];
};

export function OrderDetails({ order }: { order: OrderDetailsData }) {
  const rows: [string, React.ReactNode][] = [
    ["Asortyment", order.product],
    [
      order.logos.length === 1 ? "Logo" : `Logo (${order.logos.length})`,
      <ol key="logo" className="space-y-3">
        {order.logos.map((logo, index) => (
          <li key={index}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                  logo.kind === "DTF" ? "bg-[#e0f2fe] text-[#075985]" : "bg-accent-soft text-accent"
                }`}
              >
                {ORDER_KIND_SHORT[logo.kind]}
              </span>
              <span>
                {logo.placement ? ORDER_PLACEMENT_LABEL[logo.placement] : "Inne miejsce"}
                {logo.description ? <span className="font-normal text-muted"> — {logo.description}</span> : null}
              </span>
            </div>
            {logo.photos && logo.photos.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {logo.photos.map((photo) => (
                  <li key={photo.pathname}>
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block size-24 overflow-hidden rounded-lg border border-line bg-paper"
                      title={`Logo ${index + 1}: ${photo.filename}`}
                    >
                      <Image src={photo.url} alt={`Wzór logo ${index + 1}`} fill sizes="96px" className="object-contain" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>,
    ],
  ];

  if (order.quantity !== null) rows.push(["Ilość", `${order.quantity} szt.`]);
  if (order.createdAt) rows.push(["Złożone", formatDate(order.createdAt)]);
  if (order.notes) rows.push([order.createdAt ? "Uwagi" : "Opis", <span key="uwagi" className="whitespace-pre-wrap">{order.notes}</span>]);

  return (
    <>
      <dl className="card divide-y divide-line px-5 py-2 text-base">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {order.photos.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Zdjęcia asortymentu</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {order.photos.map((photo) => (
              <li key={photo.id} className="card overflow-hidden">
                <a href={photo.url} target="_blank" rel="noreferrer" className="relative block aspect-square bg-paper">
                  <Image src={photo.url} alt={photo.filename} fill sizes="300px" className="object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
