import Link from "next/link";

import { NavLinks } from "@/components/nav-links";

import { logOut } from "../login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Baza haftów
          </Link>

          <div className="order-3 w-full sm:order-none sm:w-auto">
            <NavLinks />
          </div>

          <form action={logOut} className="ml-auto">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
