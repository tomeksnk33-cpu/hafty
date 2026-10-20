import Link from "next/link";

import { deleteWorkEntry } from "@/app/(app)/dziennik/actions";
import { DeleteButton } from "@/components/delete-button";
import { formatDate } from "@/lib/format";
import { canChangeEntryOn, EDIT_WINDOW_DAYS, groupByDay } from "@/lib/work-entries";

export type WorkEntryRow = {
  id: string;
  userId: string;
  workDate: Date;
  quantity: number;
  notes: string | null;
  /** Nazwa z chwili wpisu — używana, gdy realizację usunięto. */
  realizationName: string;
  realization: { id: string; name: string } | null;
};

/**
 * Wpisy pogrupowane w dni, najnowszy na górze. Przyciski edycji i usuwania
 * widać tylko tam, gdzie zalogowana osoba faktycznie może coś zmienić — te same
 * reguły egzekwuje serwer w akcjach, to tylko oszczędza martwych przycisków.
 */
export function WorkDayList({
  entries,
  viewer,
  today,
  returnTo,
}: {
  entries: WorkEntryRow[];
  viewer: { id: string; isAdmin: boolean };
  today: string;
  /** Strona, na którą wracamy po edycji lub usunięciu. */
  returnTo: string;
}) {
  const days = groupByDay(entries);

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.date} id={`dzien-${day.date}`} className="card scroll-mt-4 overflow-hidden">
          <header className="flex items-baseline justify-between gap-3 border-b border-line bg-paper px-4 py-2">
            <h3 className="font-medium">{formatDate(new Date(`${day.date}T00:00:00.000Z`))}</h3>
            <span className="text-sm text-muted">{day.pieces} szt.</span>
          </header>

          <ul className="divide-y divide-line">
            {day.entries.map((entry) => {
              const editable = canChangeEntryOn(
                viewer,
                { userId: entry.userId, workDate: day.date },
                today,
              );

              const name = entry.realization?.name ?? entry.realizationName;

              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {entry.realization ? (
                        <Link
                          href={`/realizacje/${entry.realization.id}`}
                          className="hover:text-accent hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <>
                          {name} <span className="text-xs text-muted">(realizacja usunięta)</span>
                        </>
                      )}
                    </p>
                    {entry.notes ? (
                      <p className="truncate text-sm text-muted">{entry.notes}</p>
                    ) : null}
                  </div>

                  <span className="shrink-0 text-sm font-medium">{entry.quantity} szt.</span>

                  {editable ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/dziennik/${entry.id}/edytuj?wroc=${encodeURIComponent(returnTo)}`}
                        className="btn-secondary px-3 py-1"
                      >
                        Edytuj
                      </Link>
                      <DeleteButton
                        action={deleteWorkEntry.bind(null, entry.id, returnTo)}
                        label="Usuń"
                        confirmText={`Usunąć wpis „${name}” (${entry.quantity} szt.) z ${formatDate(entry.workDate)}?`}
                      />
                    </div>
                  ) : (
                    <span
                      className="shrink-0 text-xs text-muted"
                      title={`Wpisy starsze niż ${EDIT_WINDOW_DAYS} dni zmienia tylko administrator`}
                    >
                      zamknięty
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
