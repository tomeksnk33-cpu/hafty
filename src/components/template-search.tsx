"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

export type TemplateItem = {
  id: string;
  name: string;
  href: string;
  photoUrl: string | null;
  subtitle: string;
  /** Tekst, w którym szukamy: nazwa, asortyment, rodzaj, umiejscowienie, opis. */
  searchText: string;
  placeholder: string;
};

/** Bez wielkości liter i polskich znaków — „polar granat” znajdzie „Polar granatowy”. */
function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Szablony zleceń z polem wyszukiwania. Każde wpisane słowo musi pasować
 * (w dowolnym miejscu), więc „bluza plecy” zawęża do bluz z nadrukiem na plecach.
 */
export function TemplateSearch({
  templates,
  variant,
}: {
  templates: TemplateItem[];
  variant: "tiles" | "list";
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const shown =
    words.length === 0
      ? templates
      : templates.filter((template) => {
          const haystack = normalize(template.searchText);
          return words.every((word) => haystack.includes(word));
        });

  return (
    <div>
      <div className="relative mb-3">
        <label htmlFor={inputId} className="sr-only">
          Szukaj szablonu
        </label>
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
          🔍
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj szablonu: nazwa, asortyment, umiejscowienie…"
          className={`input pr-24 pl-10 ${variant === "tiles" ? "py-3 text-lg" : ""}`}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-3 py-1 text-sm text-muted hover:bg-paper hover:text-ink"
          >
            Wyczyść
          </button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">
          Brak szablonów pasujących do „{query.trim()}”.
        </p>
      ) : variant === "tiles" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((template) => (
            <li key={template.id}>
              <Link
                href={template.href}
                className="card flex h-full flex-col overflow-hidden transition-colors hover:border-accent/40"
              >
                <span className="relative block aspect-[4/3] bg-paper">
                  {template.photoUrl ? (
                    <Image src={template.photoUrl} alt="" fill sizes="300px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-3xl text-muted">
                      {template.placeholder}
                    </span>
                  )}
                </span>
                <span className="block p-3">
                  <span className="block text-lg leading-snug font-semibold">{template.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">{template.subtitle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((template) => (
            <li key={template.id}>
              <Link
                href={template.href}
                className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-accent/40"
              >
                <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-paper">
                  {template.photoUrl ? (
                    <Image src={template.photoUrl} alt="" fill sizes="64px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{template.name}</span>
                  <span className="block truncate text-sm text-muted">{template.subtitle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
