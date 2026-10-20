import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
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
}): SessionUser {
  const isAdmin = user.role === Role.ADMIN;

  return {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    isAdmin,
    canManage: isAdmin || user.canManageRealizations,
    canSeeMoney: isAdmin,
  };
}

export function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

/**
 * Pierwsze logowanie po przejściu z jednego wspólnego hasła. Dopóki w bazie nie
 * ma żadnego konta, loginem `admin` (albo ADMIN_LOGIN) i dotychczasowym hasłem
 * z APP_PASSWORD_HASH zakłada się pierwsze konto administratora. Potem baza jest
 * jedynym źródłem prawdy, a ta zmienna przestaje być używana.
 */
async function bootstrapAdmin(login: string, password: string) {
  const stored = process.env.APP_PASSWORD_HASH;
  const bootstrapLogin = normalizeLogin(process.env.ADMIN_LOGIN ?? "admin");

  if (!stored || login !== bootstrapLogin) return null;
  if ((await prisma.user.count()) > 0) return null;
  if (!verifyPassword(password, stored)) return null;

  try {
    const admin = await prisma.user.create({
      data: {
        login,
        name: "Administrator",
        passwordHash: stored,
        role: Role.ADMIN,
        canManageRealizations: true,
      },
      select: { id: true },
    });

    return admin.id;
  } catch (error) {
    // Dwa równoległe pierwsze logowania — drugie trafia na unikalny login.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.user.findUnique({ where: { login }, select: { id: true } });
      return existing?.id ?? null;
    }

    throw error;
  }
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
    return bootstrapAdmin(login, password);
  }

  const passwordMatches = verifyPassword(password, user.passwordHash);

  return passwordMatches && user.active ? user.id : null;
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

/** Wymaga prawa do dodawania i edycji haftów, klientów i nici. */
export async function requireManager() {
  const user = await requireUser();

  if (!user.canManage) redirect("/?brak=uprawnien");

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!user.isAdmin) redirect("/?brak=uprawnien");

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
