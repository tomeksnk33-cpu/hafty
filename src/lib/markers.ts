/** Znacznik nici na zdjęciu, w postaci przesyłanej przez formularz. */
export type MarkerInput = {
  /**
   * `pathname` zdjęcia, nie jego id — w formularzu zdjęcia są już wgrane do
   * magazynu, ale rekordów w bazie jeszcze nie mają. Serwer przekłada
   * pathname na id po zapisaniu realizacji.
   */
  photo: string;
  thread: string;
  /** Procent szerokości zdjęcia (0–100). */
  x: number;
  /** Procent wysokości zdjęcia (0–100). */
  y: number;
};

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

/**
 * Kolor numeru na znaczniku. Przy jasnych niciach (biel, ecru) biała cyfra
 * na białym kółku byłaby niewidoczna.
 */
export function readableOn(hex: string | null | undefined) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";

  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.6 ? "#1c1917" : "#ffffff";
}

/** Nici bez własnego koloru dostają kolor akcentu, żeby znacznik był widoczny. */
export function markerColor(hex: string | null | undefined) {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#9d2f3f";
}
