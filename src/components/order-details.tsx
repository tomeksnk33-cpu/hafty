import Image from "next/image";

import { formatDate } from "@/lib/format";
import {
  ORDER_KIND_LABEL,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  type OrderStatusValue,
  placementText,
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
  kind: "HAFT" | "DTF";
  product: string;
  placements: string[];
  placementNotes: string | null;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  photos: { id: string; url: string; filename: string }[];
};

export function OrderDetails({ order }: { order: OrderDetailsData }) {
  const rows: [string, React.ReactNode][] = [
    ["Rodzaj", ORDER_KIND_LABEL[order.kind]],
    ["Asortyment", order.product],
    ["Umiejscowienie", placementText(order.placements, order.placementNotes)],
    ["Ilość", `${order.quantity} szt.`],
    ["Złożone", formatDate(order.createdAt)],
  ];

  if (order.notes) rows.push(["Uwagi", <span key="uwagi" className="whitespace-pre-wrap">{order.notes}</span>]);

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
