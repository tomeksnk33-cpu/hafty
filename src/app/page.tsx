import Link from "next/link";

import { requireUser } from "@/lib/auth";

import { logOut } from "./login/actions";

// Ekran startowy: wybór, z której aplikacji korzystamy. Obie działają na tej
// samej bazie i tych samych kontach pracowników.
export const dynamic = "force-dynamic";

const apps = [
  {
    href: "/pulpit",
    title: "Baza haftów",
    description: "Realizacje ze zdjęciami, klienci, katalog nici i dziennik pracy.",
    mark: "H",
    markClass: "bg-accent text-white",
  },
  {
    href: "/pralnia",
    title: "Trasa pralni",
    description: "Głosowe zapisywanie trasy u klientów i mail z podsumowaniem.",
    mark: "P",
    markClass: "bg-[#1f5fa8] text-white",
  },
] as const;

export default async function AppChooserPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wybierz aplikację</h1>
          <p className="mt-1 text-sm text-muted">Zalogowano jako {user.name}.</p>
        </div>

        <form action={logOut}>
          <button type="submit" className="text-sm text-muted hover:text-ink">
            Wyloguj
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {apps.map((app) => (
          // Zwykły <a>, nie <Link>: trasa pralni to osobna, statyczna strona.
          <a
            key={app.href}
            href={app.href}
            className="card group flex flex-col gap-4 p-6 transition-colors hover:border-accent/40"
          >
            <span
              aria-hidden
              className={`flex size-12 items-center justify-center rounded-xl text-xl font-semibold ${app.markClass}`}
            >
              {app.mark}
            </span>
            <span>
              <span className="block text-lg font-semibold group-hover:text-accent">{app.title}</span>
              <span className="mt-1 block text-sm text-muted">{app.description}</span>
            </span>
          </a>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Obie aplikacje korzystają z jednej bazy i tych samych kont.{" "}
        <Link href="/konto" className="text-accent hover:underline">
          Moje konto
        </Link>
      </p>
    </main>
  );
}
