import { jwtVerify, SignJWT } from "jose";

// Ten moduł jest importowany także przez proxy.ts, dlatego nie może sięgać
// do `next/headers` ani do bazy — tylko czyste operacje na tokenie.

export const SESSION_COOKIE = "hafty_sesja";

/** 30 dni. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET musi mieć co najmniej 32 znaki. Wygeneruj: node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\"",
    );
  }

  return new TextEncoder().encode(secret);
}

/** Token niesie tylko id konta. Rolę i status sprawdzamy w bazie przy każdym żądaniu. */
export async function createSessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/**
 * Zwraca id konta z poprawnego tokenu albo `null`. Tokeny z czasów jednego
 * wspólnego hasła miały temat "wlasciciel" — odrzucamy je, żeby wszyscy
 * zalogowali się już na własne konta.
 */
export async function readSessionToken(token: string | undefined) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });

    if (!payload.sub || payload.sub === "wlasciciel") return null;

    return { userId: payload.sub };
  } catch {
    return null;
  }
}
