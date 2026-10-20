import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthNav } from "@/components/month-nav";
import { EmptyState, PageHeader, Stat } from "@/components/page-header";
import { WorkDayList } from "@/components/work-day-list";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInputValue } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import { groupByDay, parseMonth } from "@/lib/work-entries";

import { createWorkEntry } from "../../dziennik/actions";
import { loadRealizationOptions } from "../../dziennik/realization-options";
import { WorkEntryForm } from "../../dziennik/work-entry-form";

export default async function EmployeeSettlementPage(props: PageProps<"/rozliczenia/[userId]">) {
  const admin = await requireAdmin();
  const { userId } = await props.params;
  const { miesiac } = await props.searchParams;

  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, login: true, role: true, canManageRealizations: true, active: true },
  });

  if (!employee) notFound();

  const range = parseMonth(miesiac);
  const today = todayInputValue();

  const [entries, options] = await Promise.all([
    prisma.workEntry.findMany({
      where: { userId, workDate: { gte: range.start, lt: range.end } },
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
        title={employee.name}
        subtitle={`${employee.login} · ${roleLabel(employee)}${employee.active ? "" : " · konto wyłączone"}`}
        action={
          <Link href={`/rozliczenia?miesiac=${range.key}`} className="btn-secondary">
            ← Wszyscy pracownicy
          </Link>
        }
      />

      <MonthNav range={range} basePath={`/rozliczenia/${employee.id}`} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Dni z wpisem" value={days.length} />
        <Stat label="Wpisy" value={entries.length} />
        <Stat label="Sztuki" value={pieces} />
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Brak wpisów w tym miesiącu." />
      ) : (
        <WorkDayList
          entries={entries}
          viewer={admin}
          today={today}
          returnTo={`/rozliczenia/${employee.id}?miesiac=${range.key}`}
        />
      )}

      <section className="card mt-8 p-5">
        <h2 className="mb-1 font-semibold">Dodaj wpis za tę osobę</h2>
        <p className="mb-4 text-sm text-muted">
          Jako administrator możesz uzupełnić wpis z dowolnego dnia, także starszego niż tydzień.
        </p>

        <WorkEntryForm
          action={createWorkEntry}
          defaults={{ workDate: today, realizationId: "", quantity: "", notes: "" }}
          realizations={options}
          submitLabel="Dodaj wpis"
          userId={employee.id}
          maxDate={today}
        />
      </section>
    </>
  );
}
