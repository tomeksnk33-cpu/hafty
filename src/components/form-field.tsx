"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  pendingLabel = "Zapisuję…",
  pending,
}: {
  label: string;
  pendingLabel?: string;
  /** Dla formularzy wysyłanych przez `useFormSubmit` — `useFormStatus` ich nie widzi. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;

  return (
    <button type="submit" className="btn-primary" disabled={busy}>
      {busy ? pendingLabel : label}
    </button>
  );
}

export function FormField({
  label,
  name,
  hint,
  errors,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  errors?: Record<string, string[]>;
  children: React.ReactNode;
}) {
  const messages = errors?.[name];

  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
      {messages?.map((message) => (
        <p key={message} className="field-error">
          {message}
        </p>
      ))}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
      {message}
    </p>
  );
}
