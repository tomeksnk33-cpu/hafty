"use client";

import { useState, useTransition } from "react";

/**
 * Przycisk z dużym okienkiem potwierdzenia na środku ekranu (zamiast małego
 * okna przeglądarki), wygodnym na ekranie dotykowym.
 */
export function ConfirmAction({
  action,
  label,
  title,
  text,
  confirmLabel,
  buttonClassName = "btn-secondary",
  danger = false,
}: {
  action: () => Promise<unknown>;
  label: string;
  title: string;
  text?: string;
  confirmLabel: string;
  buttonClassName?: string;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="card w-full max-w-lg p-8 text-center shadow-xl">
            <h2 id="confirm-title" className="text-2xl font-semibold">
              {title}
            </h2>
            {text ? <p className="mt-3 text-lg text-muted">{text}</p> : null}

            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="btn-secondary py-4 text-lg"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Nie
              </button>
              <button
                type="button"
                className={`${danger ? "btn-danger" : "btn-primary"} py-4 text-lg`}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await action();
                    setOpen(false);
                  })
                }
              >
                {pending ? "Chwileczkę…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
