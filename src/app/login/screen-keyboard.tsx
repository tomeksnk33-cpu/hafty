"use client";

import { useState } from "react";

// Klawiatura ekranowa do logowania na monitorze dotykowym (bez fizycznej
// klawiatury). Pisze do pola, które ostatnio miało fokus: login albo hasło.

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const POLISH = ["ą", "ć", "ę", "ł", "ń", "ó", "ś", "ź", "ż"];
const SYMBOLS = [
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["-", "_", "=", "+", "[", "]", "{", "}", ";", ":"],
  ["'", '"', ",", ".", "/", "?", "\\", "|", "<", ">"],
  ["~", "`", "€", "§"],
];

type Props = {
  /** Pole, do którego teraz piszemy. */
  target: () => HTMLInputElement | null;
  /** „Dalej”: przejście do hasła albo wysłanie formularza. */
  onEnter: () => void;
  onClose: () => void;
};

const keyBase =
  "flex h-14 min-w-0 flex-1 items-center justify-center rounded-lg border text-xl font-medium shadow-sm select-none touch-manipulation sm:h-16 sm:text-2xl";
const keyClass = `${keyBase} border-line bg-paper text-ink active:bg-line`;
const keyOn = `${keyBase} border-accent bg-accent-soft text-accent`;
const keyEnter = `${keyBase} border-accent bg-accent text-white active:bg-accent/90`;

export function ScreenKeyboard({ target, onEnter, onClose }: Props) {
  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);
  const [symbols, setSymbols] = useState(false);

  const upper = shift !== caps;

  function type(text: string) {
    const el = target();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    // type=password nie zawsze pozwala ustawić zaznaczenie; wtedy kursor zostaje na końcu
    try {
      el.setSelectionRange(start + text.length, start + text.length);
    } catch {}
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if (shift) setShift(false);
  }

  function backspace() {
    const el = target();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    el.value = el.value.slice(0, from) + el.value.slice(end);
    try {
      el.setSelectionRange(from, from);
    } catch {}
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // przyciski nie zabierają fokusu polu (kursor zostaje w loginie / haśle)
  const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const letter = (k: string) => (upper ? k.toLocaleUpperCase("pl") : k);
  const rows = symbols ? SYMBOLS : ROWS;

  return (
    <div
      role="group"
      aria-label="Klawiatura ekranowa"
      className="w-full space-y-2 rounded-xl border border-line bg-surface p-2 shadow-sm sm:p-3"
      onPointerDown={keep}
      onMouseDown={keep}
    >
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1.5 sm:gap-2">
          {row.map((k) => (
            <button
              key={k}
              type="button"
              className={keyClass}
              onClick={() => type(symbols ? k : letter(k))}
            >
              {symbols ? k : letter(k)}
            </button>
          ))}
          {i === rows.length - 1 ? (
            <button
              type="button"
              className={`${keyClass} flex-[1.6] text-lg`}
              onClick={backspace}
              aria-label="Usuń znak"
            >
              ⌫
            </button>
          ) : null}
        </div>
      ))}

      {!symbols ? (
        <div className="flex gap-1.5 sm:gap-2">
          {POLISH.map((k) => (
            <button
              key={k}
              type="button"
              className={keyClass}
              onClick={() => type(letter(k))}
            >
              {letter(k)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-1.5 sm:gap-2">
        <button
          type="button"
          className={`${shift ? keyOn : keyClass} flex-[1.4] text-sm sm:text-base`}
          onClick={() => setShift((s) => !s)}
          aria-pressed={shift}
        >
          ⇧ Shift
        </button>
        <button
          type="button"
          className={`${caps ? keyOn : keyClass} flex-[1.4] text-sm sm:text-base`}
          onClick={() => setCaps((c) => !c)}
          aria-pressed={caps}
        >
          Caps
        </button>
        <button
          type="button"
          className={`${keyClass} flex-[1.4] text-sm sm:text-base`}
          onClick={() => setSymbols((s) => !s)}
        >
          {symbols ? "abc" : "#+="}
        </button>
        <button
          type="button"
          className={`${keyClass} flex-[3] text-sm sm:text-base`}
          onClick={() => type(" ")}
        >
          spacja
        </button>
        <button
          type="button"
          className={`${keyClass} flex-[1.4] text-sm sm:text-base`}
          onClick={onClose}
        >
          Ukryj
        </button>
        <button
          type="button"
          className={`${keyEnter} flex-[2] text-sm sm:text-base`}
          onClick={onEnter}
        >
          Dalej ↵
        </button>
      </div>
    </div>
  );
}
