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

export async function createSessionToken() {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("wlasciciel")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function isValidSessionToken(token: string | undefined) {
  if (!token) return false;

  try {
    await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
