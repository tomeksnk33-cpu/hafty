"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Pulpit" },
  { href: "/realizacje", label: "Realizacje" },
  { href: "/klienci", label: "Klienci" },
  { href: "/nici", label: "Nici" },
  { href: "/podsumowania", label: "Podsumowania" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
