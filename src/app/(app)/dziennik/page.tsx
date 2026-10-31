import { MonthNav } from "@/components/month-nav";
import { EmptyState, PageHeader, Stat } from "@/components/page-header";
import { WorkDayList } from "@/components/work-day-list";
import { requireEmbroideryUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plural, todayInputValue } from "@/lib/format";
import { EDIT_WINDOW_DAYS, groupByDay, oldestEditableDate, parseMonth } from "@/lib/work-entries";

import { createWorkEntry } from "./actions";
import { loadRealizationOptions } from "./realization-options";
import { WorkEntryForm } from "./work-entry-form";

export default async function WorkLogPage(props: PageProps<"/dziennik">) {
  const user = await requireEmbroideryUser();
  const { miesiac } = await props.searchParams;

  const range = parseMonth(miesiac);
  const today = todayInputValue();

  const [entries, options] = await Promise.all([
    prisma.workEntry.findMany({
      where: { userId: user.id, workDate: { gte: range.start, lt: range.end } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        userId: true,
        workDate: true,
        quantity: true,
        notes: true,
        realizationName: true,
        realization: { select: { id: true, name: true } },
      },
    }),
    loadRealizationOptions(),
  ]);

  const days = groupByDay(entries);
  const pieces = entries.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <>
      <PageHeader
        title="Mój dziennik pracy"
        subtitle="Wpisz, przy której realizacji pracowałeś i ile sztuk zrobiłeś."
      />

      <section className="card mb-8 p-5">
        <h2 className="mb-4 font-semibold">Nowy wpis</h2>

        <WorkEntryForm
          action={createWorkEntry}
          defaults={{ workDate: today, realizationId: "", quantity: "", notes: "" }}
          realizations={options}
          submitLabel="Dodaj wpis"
          minDate={user.isAdmin ? undefined : oldestEditableDate(today)}
          maxDate={today}
        />

        {user.isAdmin ? null : (
          <p className="field-hint mt-3">
            Wpisy możesz dodawać i poprawiać przez {EDIT_WINDOW_DAYS} dni. Starsze zmienia tylko
            administrator.
          </p>
        )}
      </section>

      <MonthNav range={range} basePath="/dziennik" />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Dni z wpisem" value={days.length} />
        <Stat label="Wpisy" value={entries.length} />
        <Stat label="Sztuki" value={pieces} />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="Brak wpisów w tym miesiącu."
          hint="Dodaj pierwszy wpis formularzem powyżej."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {entries.length} {plural(entries.length, "wpis", "wpisy", "wpisów")} w{" "}
            {days.length} {plural(days.length, "dniu", "dniach", "dniach")}.
          </p>

          <WorkDayList
            entries={entries}
            viewer={user}
            today={today}
            returnTo={`/dziennik?miesiac=${range.key}`}
          />
        </>
      )}
    </>
  );
}
