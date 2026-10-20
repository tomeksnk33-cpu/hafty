import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Format `scrypt:sól:hash` — ten sam, który generuje scripts/haslo.mjs, więc
// hasz z APP_PASSWORD_HASH można wprost przepisać do konta administratora.

const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

/**
 * Porównanie jest stałoczasowe, żeby nie dało się zgadywać hasła po czasie
 * odpowiedzi. Zły format hasha oznacza po prostu "nie pasuje", a nie błąd.
 */
export function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(":");

  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Hasz nieistniejącego konta. Przy nieznanym loginie liczymy na nim scrypt,
 * żeby odpowiedź nie była szybsza niż przy złym haśle do istniejącego konta
 * — inaczej po czasie dałoby się sprawdzać, jakie loginy istnieją.
 */
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));

export function spendTimeLikeAVerification(password: string) {
  verifyPassword(password, DUMMY_HASH);
}

export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Hasło może mieć najwyżej ${MAX_PASSWORD_LENGTH} znaków.`;
  }

  return null;
}
