"use client";

import { useActionState } from "react";

import { sendTestMail, type MailTestState } from "./actions";

export function MailTestForm() {
  const [state, action, pending] = useActionState<MailTestState>(sendTestMail, null);

  return (
    <form action={action} className="space-y-4">
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Wysyłam…" : "Wyślij mail testowy"}
      </button>

      {state ? (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${state.ok ? "border-line bg-paper" : "border-accent/30 bg-accent-soft"}`}
        >
          <p className="font-medium">{state.ok ? "✓ " : "✗ "}{state.ok ? state.message : "Nie udało się wysłać"}</p>
          {state.hint ? <p className="mt-1">{state.hint}</p> : null}
          {!state.ok ? <p className="mt-1 break-words font-mono text-xs text-muted">{state.message}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
