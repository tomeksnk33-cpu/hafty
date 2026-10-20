import { monthName, todayInputValue } from "@/lib/format";

/** Pracownik może dodawać i poprawiać wpisy z tylu ostatnich dni (razem z dzisiejszym). */
export const EDIT_WINDOW_DAYS = 7;

/** Dodaje (lub odejmuje) dni do daty "RRRR-MM-DD" bez udziału stref czasowych. */
export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Najstarsza data, którą zwykły pracownik jeszcze może zmienić. */
export function oldestEditableDate(today = todayInputValue()) {
  return addDays(today, -(EDIT_WINDOW_DAYS - 1));
}

/**
 * Czy dana osoba może dodać, poprawić lub usunąć wpis z tego dnia.
 * Administrator — zawsze. Pracownik — tylko własne i tylko z ostatnich dni.
 * Daty porównujemy jako tekst "RRRR-MM-DD", który układa się chronologicznie.
 */
export function canChangeEntryOn(
  user: { id: string; isAdmin: boolean },
  entry: { userId: string; workDate: string },
  today = todayInputValue(),
) {
  if (user.isAdmin) return true;
  if (entry.userId !== user.id) return false;

  return entry.workDate >= oldestEditableDate(today) && entry.workDate <= today;
}

/**
 * Dokąd wrócić po edycji lub usunięciu wpisu. Adres przychodzi z URL, więc
 * przepuszczamy tylko ścieżki wewnątrz dziennika i rozliczeń — inaczej byłby to
 * otwarty redirect na dowolną stronę.
 */
export function safeReturnPath(value: string | string[] | undefined) {
  const raw = typeof value === "string" ? value : "";
  const inside = raw.startsWith("/dziennik") || raw.startsWith("/rozliczenia");

  return inside ? raw : "/dziennik";
}

export type MonthRange = {
  /** "RRRR-MM", np. "2026-10". */
  key: string;
  year: number;
  /** Liczony od 0, jak w `Date`. */
  month: number;
  start: Date;
  /** Pierwszy dzień następnego miesiąca — górna granica wyłączna. */
  end: Date;
};

/** Czyta `?miesiac=RRRR-MM`; przy braku albo błędzie zwraca bieżący miesiąc. */
export function parseMonth(value: string | string[] | undefined): MonthRange {
  const raw = typeof value === "string" ? value : "";
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw);

  const [currentYear, currentMonth] = todayInputValue().split("-").map(Number);

  const year = match ? Number(match[1]) : currentYear;
  const month = match ? Number(match[2]) - 1 : currentMonth - 1;

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    year,
    month,
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export function shiftMonth(range: MonthRange, delta: number) {
  const shifted = new Date(Date.UTC(range.year, range.month + delta, 1));

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(range: MonthRange) {
  return `${monthName(range.month)} ${range.year}`;
}

/** Grupuje wpisy (już posortowane malejąco po dacie) w dni, zachowując kolejność. */
export function groupByDay<T extends { workDate: Date; quantity: number }>(entries: T[]) {
  const days: { date: string; entries: T[]; pieces: number }[] = [];

  for (const entry of entries) {
    const date = entry.workDate.toISOString().slice(0, 10);
    let day = days.at(-1);

    if (!day || day.date !== date) {
      day = { date, entries: [], pieces: 0 };
      days.push(day);
    }

    day.entries.push(entry);
    day.pieces += entry.quantity;
  }

  return days;
}
