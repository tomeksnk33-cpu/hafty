"use client";

import Image from "next/image";
import { useState } from "react";

import type { QuickThread } from "@/app/(app)/nici/actions";
import { clampPercent, markerColor, readableOn, type MarkerInput } from "@/lib/markers";
import type { UploadedFile } from "@/lib/uploads";

import { threadLabel } from "./thread-picker";

export function ThreadMarkerEditor({
  photos,
  threads,
  value,
  onChange,
}: {
  photos: UploadedFile[];
  threads: QuickThread[];
  value: MarkerInput[];
  // Aktualizacja funkcyjna, nie gotowa tablica — kilka kliknięć w tym samym
  // cyklu renderowania budowałoby wynik na nieaktualnym `value` i gubiło
  // wszystkie znaczniki poza ostatnim.
  onChange: (update: (current: MarkerInput[]) => MarkerInput[]) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  if (photos.length === 0 || threads.length === 0) {
    return (
      <p className="text-sm text-muted">
        {photos.length === 0
          ? "Najpierw dodaj zdjęcie — wtedy będzie na czym oznaczać nici."
          : "Najpierw wybierz nici użyte w tej realizacji."}
      </p>
    );
  }

  const photo = photos[Math.min(photoIndex, photos.length - 1)];
  const activeThread = threads.find((t) => t.id === selectedThreadId) ?? threads[0];
  const onThisPhoto = value.filter((marker) => marker.photo === photo.pathname);

  function place(xPercent: number, yPercent: number) {
    const marker: MarkerInput = {
      photo: photo.pathname,
      thread: activeThread.id,
      x: clampPercent(xPercent),
      y: clampPercent(yPercent),
    };

    onChange((current) => [...current, marker]);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    place(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  }

  function remove(marker: MarkerInput) {
    onChange((current) => current.filter((item) => item !== marker));
  }

  /** Numer nici widoczny na znaczniku — ten sam, co przy liście nici. */
  function numberOf(threadId: string) {
    return threads.findIndex((thread) => thread.id === threadId) + 1;
  }

  return (
    <div className="space-y-4">
      {photos.length > 1 ? (
        <div>
          <p className="field-hint mt-0 mb-1.5">Zdjęcie do oznaczania</p>
          <ul className="flex flex-wrap gap-2">
            {photos.map((item, index) => {
              const count = value.filter((marker) => marker.photo === item.pathname).length;
              const active = item.pathname === photo.pathname;

              return (
                <li key={item.pathname}>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    aria-pressed={active}
                    className={`relative block size-14 overflow-hidden rounded-lg border-2 ${
                      active ? "border-accent" : "border-line"
                    }`}
                  >
                    <Image src={item.url} alt="" fill sizes="56px" className="object-cover" />
                    {count > 0 ? (
                      <span className="absolute right-0 bottom-0 rounded-tl bg-ink/80 px-1 text-[10px] text-white">
                        {count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="field-hint mt-0 mb-1.5">Nić do postawienia</p>
        <ul className="flex flex-wrap gap-2">
          {threads.map((thread, index) => {
            const active = thread.id === activeThread.id;

            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  aria-pressed={active}
                  className={`chip ${active ? "border-accent bg-accent-soft" : ""}`}
                >
                  <span
                    className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: markerColor(thread.hex),
                      color: readableOn(thread.hex),
                    }}
                  >
                    {index + 1}
                  </span>
                  {threadLabel(thread)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Zdjęcie renderujemy w naturalnych proporcjach, bez kadrowania —
          inaczej procenty ze współrzędnych kliknięcia nie trafiałyby
          w to samo miejsce co na stronie realizacji. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Kliknij na zdjęciu, aby oznaczyć nić ${threadLabel(activeThread)}`}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            place(50, 50);
          }
        }}
        className="relative block w-full cursor-crosshair overflow-hidden rounded-xl border border-line bg-paper"
      >
        <Image
          src={photo.url}
          alt=""
          width={0}
          height={0}
          sizes="(max-width: 768px) 100vw, 700px"
          className="block h-auto w-full select-none"
        />

        {onThisPhoto.map((marker, index) => {
          const thread = threads.find((item) => item.id === marker.thread);
          if (!thread) return null;

          return (
            <button
              key={`${marker.photo}-${index}-${marker.x}-${marker.y}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                remove(marker);
              }}
              title={`${threadLabel(thread)} — kliknij, aby usunąć znacznik`}
              aria-label={`Usuń znacznik nici ${threadLabel(thread)}`}
              className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-md transition-transform hover:scale-110"
              style={{
                left: `${marker.x}%`,
                top: `${marker.y}%`,
                backgroundColor: markerColor(thread.hex),
                color: readableOn(thread.hex),
              }}
            >
              {numberOf(thread.id)}
            </button>
          );
        })}
      </div>

      <p className="field-hint">
        Kliknij na zdjęciu w miejsce, gdzie użyłeś zaznaczonej nici. Kliknięcie
        w gotowy znacznik usuwa go.
        {onThisPhoto.length > 0 ? ` Na tym zdjęciu: ${onThisPhoto.length}.` : ""}
      </p>
    </div>
  );
}
