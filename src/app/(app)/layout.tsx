import Link from "next/link";

import { NavLinks, type NavItem } from "@/components/nav-links";
import { requireUser, type SessionUser } from "@/lib/auth";

import { logOut } from "../login/actions";

function navigationFor(user: SessionUser): NavItem[] {
  const items: NavItem[] = [
    { href: "/", label: "Pulpit" },
    { href: "/realizacje", label: "Realizacje" },
    { href: "/dziennik", label: "Dziennik" },
  ];

  if (user.canManage) items.push({ href: "/klienci", label: "Klienci" });

  items.push({ href: "/nici", label: "Nici" });

  if (user.isAdmin) {
    items.push(
      { href: "/rozliczenia", label: "Rozliczenia" },
      { href: "/podsumowania", label: "Podsumowania" },
      { href: "/pracownicy", label: "Pracownicy" },
    );
  }

  return items;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Layout służy tu do pokazania, kto jest zalogowany. Właściwe sprawdzenia
  // uprawnień są w każdej stronie i akcji — layout nie renderuje się ponownie
  // przy przechodzeniu między stronami.
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Baza haftów
          </Link>

          <div className="order-3 w-full sm:order-none sm:w-auto">
            <NavLinks items={navigationFor(user)} />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/konto"
              title="Moje konto i zmiana hasła"
              className="max-w-40 truncate text-sm text-muted hover:text-ink"
            >
              {user.name}
            </Link>

            <form action={logOut}>
              <button type="submit" className="text-sm text-muted hover:text-ink">
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
