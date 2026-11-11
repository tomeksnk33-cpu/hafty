"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useFormSubmit } from "@/lib/use-form-submit";

import { logIn } from "./actions";
import { ScreenKeyboard } from "./screen-keyboard";

// Na monitorze dotykowym klawiatura ekranowa ma się pokazywać od razu, więc
// zapamiętujemy wybór w tej przeglądarce.
const KEYBOARD_PREF = "hafty-klawiatura-ekranowa";
const subscribeNothing = () => () => {};
function readKeyboardPref() {
  try {
    return localStorage.getItem(KEYBOARD_PREF) === "1";
  } catch {
    return false;
  }
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Sprawdzam…" : "Zaloguj się"}
    </button>
  );
}

export function LoginForm({ powrot }: { powrot: string }) {
  const { state, onSubmit, pending } = useFormSubmit(logIn);
  const passwordRef = useRef<HTMLInputElement>(null);
  const loginRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastField = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // zapamiętany wybór z tej przeglądarki (na serwerze zawsze „wyłączona”), a po kliknięciu wybór bieżący
  const remembered = useSyncExternalStore(
    subscribeNothing,
    readKeyboardPref,
    () => false,
  );
  const [chosen, setChosen] = useState<boolean | null>(null);
  const keyboard = chosen ?? remembered;

  function toggleKeyboard(on: boolean) {
    setChosen(on);
    try {
      localStorage.setItem(KEYBOARD_PREF, on ? "1" : "0");
    } catch {}
    if (on) (lastField.current ?? loginRef.current)?.focus();
  }

  function enter() {
    const field = lastField.current ?? loginRef.current;
    if (field === loginRef.current && !passwordRef.current?.value) {
      passwordRef.current?.focus();
      return;
    }
    formRef.current?.requestSubmit();
  }

  // przy klawiaturze ekranowej systemowa (telefon / tablet) się nie wysuwa
  const inputMode = keyboard ? ("none" as const) : undefined;

  // Po nieudanym logowaniu login zostaje, a hasło czyścimy i wracamy do niego kursorem.
  useEffect(() => {
    if (state?.message && passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state]);

  // Z klawiaturą: na szerokim ekranie klawiatura po lewej, formularz po prawej;
  // na wąskim klawiatura pod formularzem.
  return (
    <div
      className={
        keyboard
          ? "flex w-full flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-10"
          : "w-full max-w-sm"
      }
    >
      {keyboard ? (
        <div className="order-2 w-full lg:order-1 lg:w-[min(900px,60vw)]">
          <ScreenKeyboard
            target={() => lastField.current ?? loginRef.current}
            onEnter={enter}
            onClose={() => toggleKeyboard(false)}
          />
        </div>
      ) : null}

      <div className="order-1 w-full max-w-sm lg:order-2">
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public/, bez optymalizacji */}
          <img
            src="/brand/logo.png"
            alt="GTM Bukowski"
            className="h-16 w-auto max-w-full"
          />
        </div>

        <div className="card p-6">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
            <input type="hidden" name="powrot" value={powrot} />

            <div>
              <label className="field-label" htmlFor="login">
                Login
              </label>
              <input
                ref={loginRef}
                onFocus={(e) => (lastField.current = e.currentTarget)}
                inputMode={inputMode}
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                className="input"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="password">
                Hasło
              </label>
              <input
                ref={passwordRef}
                onFocus={(e) => (lastField.current = e.currentTarget)}
                inputMode={inputMode}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="input"
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Pokaż hasło
              </label>
            </div>

            {state?.message ? (
              <p
                role="alert"
                className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent"
              >
                {state.message}
              </p>
            ) : null}

            <SubmitButton pending={pending} />

            <button
              type="button"
              className="btn-secondary w-full py-3 text-base"
              onClick={() => toggleKeyboard(!keyboard)}
              aria-expanded={keyboard}
            >
              ⌨ {keyboard ? "Ukryj klawiaturę ekranową" : "Klawiatura ekranowa"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
