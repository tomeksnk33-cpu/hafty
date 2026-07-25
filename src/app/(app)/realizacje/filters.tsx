"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export type FilterOptions = {
  clients: { id: string; name: string }[];
  threads: { id: string; brand: string; number: string; colorName: string | null }[];
  productTypes: string[];
};

export type FilterValues = {
  q: string;
  klient: string;
  nic: string;
  typ: string;
  od: string;
  do: string;
};

export function RealizationFilters({
  options,
  values,
}: {
  options: FilterOptions;
  values: FilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(values.q);
  const [isPending, startTransition] = useTransition();

  function push(params: URLSearchParams) {
    // Zmiana filtra zawsze wraca na pierwszą stronę wyników.
    params.delete("strona");

    const next = params.toString();
    if (next === searchParams.toString()) return;

    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    push(params);
  }

  // Frazę wpisuje się literka po literce — bez opóźnienia byłoby to zapytanie
  // do bazy przy każdym znaku.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);

      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }

      push(params);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchParams, pathname]);

  const active =
    values.klient || values.nic || values.typ || values.od || values.do || values.q;

  return (
    <div className="card mb-6 space-y-4 p-4">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj po nazwie realizacji, kliencie lub nici"
          aria-label="Szukaj po nazwie realizacji, kliencie lub nici"
          className="input pr-20"
        />
        {isPending ? (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
            szukam…
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="field-hint mt-0 mb-1 block">Klient</span>
          <select
            value={values.klient}
            onChange={(event) => setParam("klient", event.target.value)}
            className="input"
          >
            <option value="">wszyscy</option>
            {options.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-hint mt-0 mb-1 block">Nić</span>
          <select
            value={values.nic}
            onChange={(event) => setParam("nic", event.target.value)}
            className="input"
          >
            <option value="">wszystkie</option>
            {options.threads.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.brand} {thread.number}
                {thread.colorName ? ` · ${thread.colorName}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-hint mt-0 mb-1 block">Typ produktu</span>
          <select
            value={values.typ}
            onChange={(event) => setParam("typ", event.target.value)}
            className="input"
          >
            <option value="">wszystkie</option>
            {options.productTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-hint mt-0 mb-1 block">Od dnia</span>
          <input
            type="date"
            value={values.od}
            onChange={(event) => setParam("od", event.target.value)}
            className="input"
          />
        </label>

        <label className="block">
          <span className="field-hint mt-0 mb-1 block">Do dnia</span>
          <input
            type="date"
            value={values.do}
            onChange={(event) => setParam("do", event.target.value)}
            className="input"
          />
        </label>
      </div>

      {active ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          className="text-sm text-accent hover:underline"
        >
          Wyczyść filtry
        </button>
      ) : null}
    </div>
  );
}
