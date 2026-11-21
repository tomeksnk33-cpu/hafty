import Link from "next/link";

import { requireClient } from "@/lib/auth";

import { logOut } from "../login/actions";
import { PortalNav } from "./portal-nav";

/** Strefa klienta haftów: tylko jego zlecenia, bez nawigacji pracowników. */
export default async function ClientOrdersLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClient();

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/moje-zlecenia" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public/ */}
            <img src="/brand/logo.png" alt="GTM Bukowski" className="h-8 w-auto" />
            <span className="text-lg font-semibold tracking-tight">Moje zlecenia</span>
          </Link>

          <div className="order-3 w-full sm:order-none sm:w-auto">
            <PortalNav />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Link href="/konto" title="Zmiana hasła" className="max-w-48 truncate text-sm text-muted hover:text-ink">
              {user.name}
            </Link>
            <form action={logOut}>
              <button type="submit" className="btn-secondary">
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
