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

/** Najwięcej logo na jednym asortymencie. */
export const ORDER_MAX_LOGOS = 20;

/** Krótka nazwa rodzaju na liście logo. */
export const ORDER_KIND_SHORT: Record<OrderKindValue, string> = { HAFT: "Haft", DTF: "DTF" };

/** Najwięcej zdjęć (wzorów) przy jednym logo. */
export const ORDER_MAX_LOGO_PHOTOS = 5;

export type OrderPhotoData = { url: string; pathname: string; filename: string; sizeBytes: number };

export type OrderLogoData = {
  kind: OrderKindValue;
  placement: OrderPlacementValue | null;
  description: string | null;
  photos?: OrderPhotoData[];
};

/** Jak pobierać logo zlecenia/szablonu z bazy — razem z ich zdjęciami. */
export const LOGO_QUERY = {
  orderBy: { position: "asc" },
  select: {
    kind: true,
    placement: true,
    description: true,
    photos: {
      orderBy: { position: "asc" },
      select: { url: true, pathname: true, filename: true, sizeBytes: true },
    },
  },
} as const;

/** Jedno logo jako tekst, np. „Haft: Przód lewy (logo 8 cm)”. */
export function logoText(logo: OrderLogoData) {
  const where = logo.placement ? ORDER_PLACEMENT_LABEL[logo.placement] : null;
  const what = where && logo.description ? `${where} (${logo.description})` : (where ?? logo.description ?? "inne miejsce");

  return `${ORDER_KIND_SHORT[logo.kind]}: ${what}`;
}

/** Wszystkie logo w jednej linii — do list. */
export function logosText(logos: OrderLogoData[]) {
  return logos.length > 0 ? logos.map(logoText).join(" · ") : "—";
}

export function orderNumber(number: number) {
  return `Z-${String(number).padStart(4, "0")}`;
}

/** Szablon jako pozycja listy z wyszukiwarką (components/template-search.tsx). */
export function templateItem(
  template: {
    id: string;
    name: string;
    product: string;
    notes: string | null;
    photos: { url: string }[];
    logos: OrderLogoData[];
  },
  href: string,
) {
  const subtitle = logosText(template.logos);
  const kinds = new Set(template.logos.map((logo) => logo.kind));

  return {
    id: template.id,
    name: template.name,
    href,
    photoUrl: template.photos[0]?.url ?? template.logos.find((logo) => logo.photos?.length)?.photos?.[0]?.url ?? null,
    subtitle,
    searchText: [
      template.name,
      template.product,
      subtitle,
      ...template.logos.map((logo) => ORDER_KIND_LABEL[logo.kind]),
      template.notes ?? "",
    ].join(" "),
    placeholder: kinds.size === 1 && kinds.has("DTF") ? "DTF" : "🧵",
  };
}
