/** Wspólne nazwy i reguły zleceń klientów haftów — używane przez serwer i przeglądarkę. */

export const ORDER_KINDS = ["HAFT", "DTF"] as const;
export type OrderKindValue = (typeof ORDER_KINDS)[number];

export const ORDER_KIND_LABEL: Record<OrderKindValue, string> = {
  HAFT: "Haft",
  DTF: "DTF (nadruk)",
};

export const ORDER_PLACEMENTS = ["PLECY", "PRZOD_LEWY", "PRZOD_PRAWY", "REKAW"] as const;
export type OrderPlacementValue = (typeof ORDER_PLACEMENTS)[number];

export const ORDER_PLACEMENT_LABEL: Record<OrderPlacementValue, string> = {
  PLECY: "Plecy",
  PRZOD_LEWY: "Przód lewy",
  PRZOD_PRAWY: "Przód prawy",
  REKAW: "Rękaw",
};

export const ORDER_STATUSES = ["NOWE", "W_REALIZACJI", "GOTOWE", "ANULOWANE"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  NOWE: "Nowe",
  W_REALIZACJI: "W realizacji",
  GOTOWE: "Gotowe",
  ANULOWANE: "Anulowane",
};

/** Kolory plakietek statusu. */
export const ORDER_STATUS_CLASS: Record<OrderStatusValue, string> = {
  NOWE: "bg-[#dbeafe] text-[#1e40af]",
  W_REALIZACJI: "bg-[#fef3c7] text-[#92400e]",
  GOTOWE: "bg-[#dcfce7] text-[#166534]",
  ANULOWANE: "bg-paper text-muted",
};

/** Najwięcej zdjęć asortymentu w jednym zleceniu. */
export const ORDER_MAX_PHOTOS = 10;

/** Folder w magazynie plików na zdjęcia z zleceń. */
export const ORDER_PHOTO_FOLDER = "zlecenia";

/** Umiejscowienie jako jeden tekst, np. „Plecy, Przód lewy — logo 8 cm”. */
export function placementText(placements: readonly string[], notes: string | null) {
  const names = placements.map(
    (value) => ORDER_PLACEMENT_LABEL[value as OrderPlacementValue] ?? value,
  );
  const parts = [names.join(", "), notes ?? ""].filter((part) => part !== "");

  return parts.length > 0 ? parts.join(" — ") : "—";
}

export function orderNumber(number: number) {
  return `Z-${String(number).padStart(4, "0")}`;
}

/** Szablon jako pozycja listy z wyszukiwarką (components/template-search.tsx). */
export function templateItem(
  template: {
    id: string;
    name: string;
    kind: OrderKindValue;
    product: string;
    placements: readonly string[];
    placementNotes: string | null;
    notes: string | null;
    photos: { url: string }[];
  },
  href: string,
) {
  const subtitle = `${ORDER_KIND_LABEL[template.kind]} · ${placementText(template.placements, template.placementNotes)}`;

  return {
    id: template.id,
    name: template.name,
    href,
    photoUrl: template.photos[0]?.url ?? null,
    subtitle,
    searchText: [template.name, template.product, subtitle, template.notes ?? ""].join(" "),
    placeholder: template.kind === "DTF" ? "DTF" : "🧵",
  };
}
