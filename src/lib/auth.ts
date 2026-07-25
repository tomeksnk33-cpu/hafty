import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import {
  createSessionToken,
  isValidSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/session";

/**
 * Sprawdza hasło względem hashu z APP_PASSWORD_HASH (format `scrypt:sól:hash`).
 * Porównanie jest stałoczasowe, żeby nie dało się zgadywać hasła po czasie odpowiedzi.
 */
export function isPasswordCorrect(password: string) {
  const stored = process.env.APP_PASSWORD_HASH;

  if (!stored) {
    throw new Error(
      'Brak zmiennej APP_PASSWORD_HASH. Wygeneruj ją poleceniem: npm run haslo "twoje-haslo"',
    );
  }

  const [algorithm, salt, expectedHex] = stored.split(":");

  if (algorithm !== "scrypt" || !salt || !expectedHex) {
    throw new Error(
      'APP_PASSWORD_HASH ma zły format. Wygeneruj go ponownie: npm run haslo "twoje-haslo"',
    );
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function startSession() {
  const jar = await cookies();

  jar.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function isLoggedIn() {
  const jar = await cookies();
  return isValidSessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Opóźnia odpowiedź po błędnym haśle o losowe 250–600 ms. Na serverless nie da
 * się trzymać licznika prób w pamięci, więc to tylko spowolnienie zgadywania,
 * a nie pełny rate limit.
 */
export async function delayFailedLogin() {
  const ms = 250 + (randomBytes(1)[0] / 255) * 350;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
