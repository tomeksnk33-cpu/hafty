"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { plural } from "@/lib/format";
import { markerColor, readableOn } from "@/lib/markers";

export type GalleryThread = {
  id: string;
  brand: string;
  number: string;
  colorName: string | null;
  hex: string | null;
};

export type GalleryPhoto = {
  id: string;
  url: string;
  markers: { id: string; threadId: string; x: number; y: number }[];
};

function label(thread: GalleryThread) {
  return `${thread.brand} ${thread.number}${thread.colorName ? ` · ${thread.colorName}` : ""}`;
}

/**
 * Zdjęcia realizacji razem z legendą nici. Jeden komponent, bo numer na
 * znaczniku i numer na liście nici muszą się podświetlać razem — to cały
 * sens oznaczania nici o zbliżonych kolorach.
 */
export function RealizationGallery({
  photos,
  threads,
  alt,
}: {
  photos: GalleryPhoto[];
  threads: GalleryThread[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const photo = photos[Math.min(active, photos.length - 1)];

  const numberOf = (threadId: string) =>
    threads.findIndex((thread) => thread.id === threadId) + 1;

  const markerCount = (threadId: string) =>
    photos.reduce(
      (sum, item) => sum + item.markers.filter((m) => m.threadId === threadId).length,
      0,
    );

  return (
    <div>
      {photo ? (
        <>
          {/* Zdjęcie w naturalnych proporcjach — kadrowanie przesunęłoby
              znaczniki względem miejsc, w których je postawiono. */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-paper">
            <Image
              src={photo.url}
              alt={alt}
              width={0}
              height={0}
              sizes="(max-width: 1024px) 100vw, 60vw"
              priority
              className="block h-auto w-full"
            />

            {photo.markers.map((marker) => {
              const thread = threads.find((item) => item.id === marker.threadId);
              if (!thread) return null;

              const dimmed = highlighted !== null && highlighted !== thread.id;
              const lit = highlighted === thread.id;

              return (
                <span
                  key={marker.id}
                  title={label(thread)}
                  onMouseEnter={() => setHighlighted(thread.id)}
                  onMouseLeave={() => setHighlighted(null)}
                  className={`absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-md transition-all ${
                    dimmed ? "opacity-30" : ""
                  } ${lit ? "scale-125 ring-2 ring-ink/40" : ""}`}
                  style={{
                    left: `${marker.x}%`,
                    top: `${marker.y}%`,
                    backgroundColor: markerColor(thread.hex),
                    color: readableOn(thread.hex),
                  }}
                >
                  {numberOf(thread.id)}
                </span>
              );
            })}
          </div>

          {photos.length > 1 ? (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {photos.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Zdjęcie ${index + 1} z ${photos.length}`}
                    aria-current={index === active}
                    className={`relative block aspect-square w-full overflow-hidden rounded-lg border ${
                      index === active ? "border-accent" : "border-line"
                    }`}
                  >
                    <Image src={item.url} alt="" fill sizes="120px" className="object-cover" />
                    {item.markers.length > 0 ? (
                      <span className="absolute right-0 bottom-0 rounded-tl bg-ink/80 px-1 text-[10px] text-white">
                        {item.markers.length}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className="card flex aspect-4/3 items-center justify-center text-sm text-muted">
          Brak zdjęć
        </div>
      )}

      {threads.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 font-semibold">Użyte nici</h2>

          <ul className="space-y-1">
            {threads.map((thread, index) => {
              const count = markerCount(thread.id);
              const lit = highlighted === thread.id;

              return (
                <li key={thread.id}>
                  <Link
                    href={`/nici/${thread.id}`}
                    onMouseEnter={() => setHighlighted(thread.id)}
                    onMouseLeave={() => setHighlighted(null)}
                    onFocus={() => setHighlighted(thread.id)}
                    onBlur={() => setHighlighted(null)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      lit ? "border-accent bg-accent-soft" : "border-line bg-surface"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-xs font-bold"
                      style={{
                        backgroundColor: markerColor(thread.hex),
                        color: readableOn(thread.hex),
                      }}
                    >
                      {index + 1}
                    </span>

                    <span className="min-w-0 flex-1 truncate">{label(thread)}</span>

                    <span className="shrink-0 text-xs text-muted">
                      {count > 0
                        ? `${count} ${plural(count, "znacznik", "znaczniki", "znaczników")}`
                        : "bez znacznika"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {photos.length > 0 && photos.every((item) => item.markers.length === 0) ? (
            <p className="field-hint">
              Nici nie są jeszcze oznaczone na zdjęciu — możesz to zrobić w edycji realizacji.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
