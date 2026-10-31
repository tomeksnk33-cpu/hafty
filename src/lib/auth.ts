import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { spendTimeLikeAVerification, verifyPassword } from "@/lib/passwords";
import {
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/session";

/** Zalogowana osoba razem z tym, co jej wolno. Zawsze liczona z aktualnych danych z bazy. */
export type SessionUser = {
  id: string;
  login: string;
  name: string;
  role: Role;
  isAdmin: boolean;
  /** Dostęp do bazy haftów. */
  canUseEmbroidery: boolean;
  /** Dostęp do trasy pralni. */
  canUseLaundry: boolean;
  /** Dostęp do rejestratora czasu pracy. */
  canUseTimeclock: boolean;
  /** Dostęp do listy obecności Brzozów. */
  canUseAttendance: boolean;
  /** Dodawanie i edycja haftów, klientów i nici. */
  canManage: boolean;
  /** Ceny, wartości i podsumowania finansowe. */
  canSeeMoney: boolean;
};

function toSessionUser(user: {
  id: string;
  login: string;
  name: string;
  role: Role;
  canManageRealizations: boolean;
  canUseEmbroidery: boolean;
  canUseLaundry: boolean;
  canUseTimeclock: boolean;
  canUseAttendance: boolean;
}): SessionUser {
  const isAdmin = user.role === Role.ADMIN;
  const canUseEmbroidery = isAdmin || user.canUseEmbroidery;

  return {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    isAdmin,
    canUseEmbroidery,
    canUseLaundry: isAdmin || user.canUseLaundry,
    canUseTimeclock: isAdmin || user.canUseTimeclock,
    canUseAttendance: isAdmin || user.canUseAttendance,
    canManage: isAdmin || (canUseEmbroidery && user.canManageRealizations),
    canSeeMoney: isAdmin,
  };
}

export function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

/**
 * Hasz z APP_PASSWORD_HASH. W panelu Vercel łatwo wkleić go razem z
 * cudzysłowami albo z przedrostkiem `APP_PASSWORD_HASH=` (tak wypisuje go
 * `npm run haslo`), więc te dodatki obcinamy.
 */
function recoveryHash() {
  const raw = (process.env.APP_PASSWORD_HASH ?? "").trim().replace(/^APP_PASSWORD_HASH=/, "");
  const stored = raw.replace(/^["']|["']$/g, "").trim();

  return stored.startsWith("scrypt:") ? stored : null;
}

/**
 * Pierwsze logowanie i odzyskanie dostępu administratora. Loginem `admin`
 * (albo ADMIN_LOGIN) i hasłem, z którego powstał APP_PASSWORD_HASH:
 *
 * - zakłada się konto administratora, jeśli takiego loginu nie ma,
 * - albo istniejące konto o tym loginie dostaje to hasło, zostaje włączone
 *   i ma rolę administratora (gdy ktoś zapomniał hasła).
 *
 * Działa tylko, dopóki zmienna jest ustawiona — po zalogowaniu należy ją
 * usunąć z Vercel i zmienić hasło w „Moje konto".
 */
async function recoverAdmin(login: string, password: string) {
  const stored = recoveryHash();
  const adminLogin = normalizeLogin(process.env.ADMIN_LOGIN ?? "admin");

  if (!stored || login !== adminLogin) return null;
  if (!verifyPassword(password, stored)) return null;

  const admin = await prisma.user.upsert({
    where: { login },
    create: {
      login,
      name: "Administrator",
      passwordHash: stored,
      role: Role.ADMIN,
      canManageRealizations: true,
    },
    update: { passwordHash: stored, role: Role.ADMIN, active: true },
    select: { id: true },
  });

  return admin.id;
}

/** Zwraca id konta po poprawnym loginie i haśle albo `null`. Nie zdradza, co było złe. */
export async function authenticate(loginInput: string, password: string) {
  const login = normalizeLogin(loginInput);

  const user = await prisma.user.findUnique({
    where: { login },
    select: { id: true, passwordHash: true, active: true },
  });

  if (!user) {
    spendTimeLikeAVerification(password);
    return recoverAdmin(login, password);
  }

  if (verifyPassword(password, user.passwordHash) && user.active) return user.id;

  return recoverAdmin(login, password);
}

export async function startSession(userId: string) {
  const jar = await cookies();

  jar.set(SESSION_COOKIE, await createSessionToken(userId), {
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

/**
 * Zalogowana osoba albo `null`. Za każdym razem czyta konto z bazy, więc
 * wyłączenie konta albo zmiana roli działa od razu, a nie dopiero po
 * wygaśnięciu 30-dniowego ciasteczka. `cache` zapobiega ponownemu zapytaniu
 * w obrębie jednego żądania.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      login: true,
      name: true,
      role: true,
      canManageRealizations: true,
      canUseEmbroidery: true,
      canUseLaundry: true,
      canUseTimeclock: true,
      canUseAttendance: true,
      active: true,
    },
  });

  if (!user || !user.active) return null;

  return toSessionUser(user);
});

// Sprawdzenia uprawnień muszą być w każdej stronie i akcji, a nie tylko w
// layoucie — layouty nie renderują się ponownie przy nawigacji, a akcje
// serwerowe to publiczne endpointy, które da się wywołać bez interfejsu.

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  return user;
}

/** Wymaga dostępu do bazy haftów. Bez niego — powrót do ekranu wyboru aplikacji. */
export async function requireEmbroideryUser() {
  const user = await requireUser();

  if (!user.canUseEmbroidery) redirect("/?brak=hafty");

  return user;
}

/** Wymaga prawa do dodawania i edycji haftów, klientów i nici. */
export async function requireManager() {
  const user = await requireEmbroideryUser();

  if (!user.canManage) redirect("/pulpit?brak=uprawnien");

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!user.isAdmin) redirect("/pulpit?brak=uprawnien");

  return user;
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
