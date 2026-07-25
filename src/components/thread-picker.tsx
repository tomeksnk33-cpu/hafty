"use client";

import { useEffect, useState } from "react";

import { createThreadInline, searchThreads } from "@/app/(app)/nici/actions";
import type { QuickThread } from "@/app/(app)/nici/actions";

export function threadLabel(thread: QuickThread) {
  return `${thread.brand} ${thread.number}${thread.colorName ? ` · ${thread.colorName}` : ""}`;
}

function Swatch({ hex }: { hex: string | null }) {
  if (!hex) return null;

  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full border border-line"
      style={{ backgroundColor: hex }}
    />
  );
}

/**
 * Komponent sterowany — wybrane nici trzyma formularz, bo są potrzebne także
 * edytorowi znaczników na zdjęciu.
 */
export function ThreadPicker({
  value,
  onChange,
}: {
  value: QuickThread[];
  // Aktualizacja funkcyjna — dwa kliknięcia pod rząd nie mogą się nadpisać.
  onChange: (update: (current: QuickThread[]) => QuickThread[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickThread[]>([]);
  const [searching, setSearching] = useState(false);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ brand: "", number: "", colorName: "", hex: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      const found = await searchThreads(query);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function add(thread: QuickThread) {
    onChange((current) =>
      current.some((item) => item.id === thread.id) ? current : [...current, thread],
    );
  }

  async function saveNewThread() {
    setSaving(true);
    setCreateError(null);

    const result = await createThreadInline(draft);

    if ("error" in result) {
      setCreateError(result.error);
    } else {
      add(result.thread);
      setDraft({ brand: "", number: "", colorName: "", hex: "" });
      setCreating(false);
      // Nowa nić powinna być widoczna też na liście podpowiedzi.
      setResults(await searchThreads(query));
    }

    setSaving(false);
  }

  const available = results.filter((thread) => !value.some((item) => item.id === thread.id));

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((thread, index) => (
            <li key={thread.id}>
              <span className="chip">
                <span className="font-medium text-muted">{index + 1}.</span>
                <Swatch hex={thread.hex} />
                {threadLabel(thread)}
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) => current.filter((item) => item.id !== thread.id))
                  }
                  aria-label={`Usuń ${threadLabel(thread)}`}
                  className="ml-0.5 text-muted hover:text-accent"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nie wybrano jeszcze żadnej nici.</p>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSearching(true);
        }}
        placeholder="Szukaj nici po numerze, kolorze lub producencie"
        aria-label="Szukaj nici"
        className="input"
      />

      <div className="card max-h-56 overflow-y-auto">
        {available.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">
            {searching
              ? "Szukam…"
              : results.length > 0
                ? "Wszystkie pasujące nici są już wybrane."
                : "Brak pasujących nici w katalogu."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {available.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => add(thread)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper"
                >
                  <Swatch hex={thread.hex} />
                  {threadLabel(thread)}
                  <span className="ml-auto text-xs text-muted">dodaj</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="field-hint">
        Możesz dodać dowolnie wiele nici — klikaj kolejne pozycje z listy.
      </p>

      {creating ? (
        // Nie może to być <form> — cały picker siedzi w formularzu realizacji.
        <div className="card space-y-3 p-4">
          <p className="text-sm font-medium">Nowa nić</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.brand}
              onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
              placeholder="Producent, np. Madeira"
              aria-label="Producent"
              className="input"
            />
            <input
              value={draft.number}
              onChange={(event) => setDraft({ ...draft, number: event.target.value })}
              placeholder="Numer, np. 1147"
              aria-label="Numer nici"
              className="input"
            />
            <input
              value={draft.colorName}
              onChange={(event) => setDraft({ ...draft, colorName: event.target.value })}
              placeholder="Nazwa koloru"
              aria-label="Nazwa koloru"
              className="input"
            />
            <input
              value={draft.hex}
              onChange={(event) => setDraft({ ...draft, hex: event.target.value })}
              placeholder="#1b2a4a"
              aria-label="Kolor podglądu"
              className="input"
            />
          </div>

          {createError ? <p className="field-error">{createError}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveNewThread()}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Zapisuję…" : "Dodaj do katalogu"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateError(null);
              }}
              className="btn-secondary"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-sm text-accent hover:underline"
        >
          + Nie ma takiej nici — dodaj nową
        </button>
      )}
    </div>
  );
}
