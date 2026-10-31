import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { getCurrentUser } from "@/lib/auth";

import { HttpError } from "./errors";
import { getValue, increment, setValue, setValueIfAbsent } from "./store";

// Dwa poziomy dostępu:
//  - konto w aplikacji z uprawnieniem do rejestratora (np. konto tabletu przy drzwiach),
//  - hasło kierownika (ustawiane w rejestratorze, zapisane jako skrót scrypt): token ważny
//    5 minut od ostatniej czynności kierownika, przesyłany w nagłówku X-Admin-Token.

export const ADMIN_TTL_MS = 5 * 60_000;
const MAX_FAILS = 20;
const FAIL_WINDOW_S = 15 * 60;
const ADMIN_KEY = "admin";

/** Zalogowana osoba z dostępem do rejestratora. 401 bez sesji, 403 bez uprawnienia. */
export async function requireTimeclockUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Zaloguj się ponownie.");
  if (!user.canUseTimeclock) throw new HttpError(403, "Twoje konto nie ma dostępu do rejestratora czasu pracy.");
  return user;
}

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HttpError(500, "Brak SESSION_SECRET w ustawieniach serwera.");
  return createHmac("sha256", secret).update("rejestrator-kierownik").digest();
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");

function sign(payload: object) {
  const body = b64(JSON.stringify(payload));
  return body + "." + createHmac("sha256", key()).update(body).digest("base64url");
}

function verify(token: string | null): { k?: string; v?: number; exp: number } | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const good = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const ipOf = (req: Request) =>
  (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";

async function checkFails(req: Request) {
  const n = Number((await getValue("fail:" + ipOf(req))) || 0);
  if (n >= MAX_FAILS) throw new HttpError(429, "Zbyt wiele błędnych haseł. Spróbuj ponownie za 15 minut.");
}

async function addFail(req: Request) {
  await increment("fail:" + ipOf(req), FAIL_WINDOW_S);
}

const sameText = (a: string, b: string) => {
  const x = createHmac("sha256", "cmp").update(String(a)).digest();
  const y = createHmac("sha256", "cmp").update(String(b)).digest();
  return timingSafeEqual(x, y);
};

type AdminRecord = { salt: string; hash: string; v: number };

const hashPass = (pw: string, salt: string) => scryptSync(String(pw), salt, 32).toString("hex");

async function adminRecord(): Promise<AdminRecord | null> {
  const raw = await getValue(ADMIN_KEY);
  return raw ? JSON.parse(raw) : null;
}

export const adminIsSet = async () => !!(await adminRecord());

const adminToken = (rec: AdminRecord) => sign({ k: "adm", v: rec.v, exp: Date.now() + ADMIN_TTL_MS });

export async function setupAdmin(password: string) {
  if (String(password).length < 4) throw new HttpError(400, "Hasło musi mieć co najmniej 4 znaki.");
  const salt = randomBytes(16).toString("hex");
  const rec = { salt, hash: hashPass(password, salt), v: 1 };
  if (!(await setValueIfAbsent(ADMIN_KEY, JSON.stringify(rec)))) {
    throw new HttpError(409, "Hasło kierownika jest już ustawione.");
  }
  return adminToken(rec);
}

export async function loginAdmin(req: Request, password: string) {
  await checkFails(req);
  const rec = await adminRecord();
  if (!rec) throw new HttpError(409, "Hasło kierownika nie jest jeszcze ustawione.");
  if (!sameText(hashPass(password, rec.salt), rec.hash)) {
    await addFail(req);
    throw new HttpError(401, "Nieprawidłowe hasło.");
  }
  return adminToken(rec);
}

/** Sprawdza tryb kierownika i zwraca nowy token (przedłuża go o kolejne 5 minut). */
export async function requireAdmin(req: Request) {
  const p = verify(req.headers.get("x-admin-token"));
  const rec = p?.k === "adm" ? await adminRecord() : null;
  if (!rec || rec.v !== p?.v) {
    throw new HttpError(403, "Tryb kierownika wygasł. Podaj hasło kierownika ponownie.");
  }
  return adminToken(rec);
}

export async function changeAdmin(password: string) {
  if (String(password).length < 4) throw new HttpError(400, "Hasło musi mieć co najmniej 4 znaki.");
  const old = await adminRecord();
  const salt = randomBytes(16).toString("hex");
  // nowy numer wersji unieważnia stare tokeny
  const rec = { salt, hash: hashPass(password, salt), v: (old?.v ?? 0) + 1 };
  await setValue(ADMIN_KEY, JSON.stringify(rec));
  return adminToken(rec);
}
