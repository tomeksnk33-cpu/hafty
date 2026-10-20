"use client";

import { startTransition, useActionState } from "react";

import type { FormState } from "@/lib/validation";

/**
 * `useActionState` z wysyłką ręczną zamiast `<form action={…}>`.
 *
 * React 19 po zakończeniu akcji formularza czyści jego pola — także wtedy, gdy
 * akcja zwróciła błąd walidacji. Wpisana data, ilość czy opis znikały, a
 * użytkownik musiał zaczynać od nowa przez jedną literówkę. Wysyłając dane z
 * `onSubmit` omijamy ten reset: po błędzie pola zostają, a po udanym zapisie
 * formularze, które tego chcą, czyszczą się zmianą `key`.
 *
 * Do wskaźnika oczekiwania służy `pending` (`useFormStatus` działa tylko z
 * propsem `action`).
 */
export function useFormSubmit(
  action: (state: FormState, formData: FormData) => Promise<FormState>,
) {
  const [state, formAction, pending] = useActionState(action, null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    startTransition(() => {
      formAction(data);
    });
  }

  return { state, onSubmit, pending };
}
