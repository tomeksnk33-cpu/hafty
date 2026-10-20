import Link from "next/link";

import { monthLabel, parseMonth, shiftMonth, type MonthRange } from "@/lib/work-entries";

/** Przełącznik miesięcy oparty o `?miesiac=RRRR-MM`. */
export function MonthNav({ range, basePath }: { range: MonthRange; basePath: string }) {
  const current = parseMonth(undefined);
  const isCurrent = range.key === current.key;

  const href = (key: string) => `${basePath}?miesiac=${key}`;

  return (
    <nav aria-label="Wybór miesiąca" className="mb-6 flex flex-wrap items-center gap-2">
      <Link
        href={href(shiftMonth(range, -1))}
        aria-label="Poprzedni miesiąc"
        className="btn-secondary px-3"
      >
        ←
      </Link>

      <span className="min-w-40 text-center font-medium capitalize">{monthLabel(range)}</span>

      <Link
        href={href(shiftMonth(range, 1))}
        aria-label="Następny miesiąc"
        className="btn-secondary px-3"
      >
        →
      </Link>

      {isCurrent ? null : (
        <Link href={href(current.key)} className="ml-2 text-sm text-accent hover:underline">
          Bieżący miesiąc
        </Link>
      )}
    </nav>
  );
}
