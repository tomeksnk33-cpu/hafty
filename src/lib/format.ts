const money = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

const longDate = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const monthNames = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  timeZone: "UTC",
});

/** Kwoty trzymamy w groszach, żeby uniknąć błędów zaokrągleń. */
export function formatMoney(grosze: number | null | undefined) {
  if (grosze === null || grosze === undefined) return "—";
  return money.format(grosze / 100);
}

/**
 * Zamienia wpisaną kwotę na grosze. Przyjmuje "12,50", "12.50", "1 200,00".
 * Zwraca `null` dla pustego wejścia i `undefined`, gdy tekst nie jest kwotą.
 */
export function parseMoney(input: string): number | null | undefined {
  const cleaned = input.replace(/\s/g, "").replace(",", ".");

  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;

  return Math.round(Number(cleaned) * 100);
}

/**
 * Pola typu `@db.Date` wracają z Postgresa jako północ UTC. Formatujemy w UTC,
 * bo przeliczenie na strefę lokalną potrafi cofnąć datę o jeden dzień.
 */
export function formatDate(date: Date) {
  return longDate.format(date);
}

export function formatDateShort(date: Date) {
  return shortDate.format(date);
}

/** "styczeń", "luty", … — `month` liczony od 0, jak w `Date`. */
export function monthName(month: number) {
  return monthNames.format(new Date(Date.UTC(2000, month, 1)));
}

/** Format wymagany przez `<input type="date">`. */
export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/** Rozmiar pliku w formie czytelnej dla człowieka. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3 realizacje" — polska odmiana rzeczownika po liczbie. */
export function plural(count: number, one: string, few: string, many: string) {
  if (count === 1) return one;

  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 12 && lastTwo <= 14) return many;
  if (last >= 2 && last <= 4) return few;

  return many;
}
