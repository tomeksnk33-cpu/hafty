"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Pole wyszukiwania trzymające frazę w adresie URL, dzięki czemu wynik
 * wyszukiwania da się dodać do zakładek i cofnąć przyciskiem wstecz.
 */
export function SearchField({
  name = "q",
  placeholder,
  defaultValue = "",
}: {
  name?: string;
  placeholder: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);

      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }

      // Nowa fraza to nowy zbiór wyników — numer strony przestaje mieć sens.
      params.delete("strona");

      const next = params.toString();
      if (next === searchParams.toString()) return;

      startTransition(() => {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, name, pathname, router, searchParams]);

  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pr-20"
      />
      {isPending ? (
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
          szukam…
        </span>
      ) : null}
    </div>
  );
}
