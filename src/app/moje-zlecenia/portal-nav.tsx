"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/moje-zlecenia", label: "Zlecenia" },
  { href: "/moje-zlecenia/szablony", label: "Szablony" },
];

/** Zakładki strefy klienta. Szablony mają własną ścieżkę pod zleceniami, więc aktywną wybieramy po najdłuższym dopasowaniu. */
export function PortalNav() {
  const pathname = usePathname();
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active === item.href ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-base font-medium ${
            active === item.href ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
