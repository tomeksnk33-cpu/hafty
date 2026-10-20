import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

export default async function EmployeesPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      login: true,
      role: true,
      canManageRealizations: true,
      active: true,
      _count: { select: { workEntries: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Pracownicy"
        subtitle={`${users.length} ${plural(users.length, "konto", "konta", "kont")}`}
        action={
          <Link href="/pracownicy/nowy" className="btn-primary">
            Dodaj pracownika
          </Link>
        }
      />

      {users.length === 0 ? (
        <EmptyState title="Nie ma jeszcze kont." />
      ) : (
        <ul className="card divide-y divide-line">
          {users.map((user) => (
            <li key={user.id}>
              <Link
                href={`/pracownicy/${user.id}/edytuj`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${user.active ? "" : "text-muted line-through"}`}>
                    {user.name}
                    {user.id === admin.id ? (
                      <span className="ml-2 text-xs font-normal text-muted no-underline">
                        (to Ty)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {user.login} · {roleLabel(user)}
                  </p>
                </div>

                {user.active ? null : <span className="chip">wyłączone</span>}

                <span className="shrink-0 text-sm text-muted">
                  {user._count.workEntries}{" "}
                  {plural(user._count.workEntries, "wpis", "wpisy", "wpisów")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sm text-muted">
        Konta się nie usuwa, tylko wyłącza — dzięki temu wpisy byłych pracowników zostają w
        rozliczeniach.
      </p>
    </>
  );
}
