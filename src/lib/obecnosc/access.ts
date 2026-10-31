import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser, type SessionUser } from "@/lib/auth";

type Result = { user: SessionUser; denied?: never } | { user?: never; denied: NextResponse };

/**
 * Zalogowana osoba z dostępem do listy obecności albo gotowa odpowiedź z
 * błędem: 401 bez sesji, 403 bez uprawnienia (albo bez roli administratora,
 * gdy `admin` jest ustawione).
 */
export async function attendanceUser({ admin = false } = {}): Promise<Result> {
  const user = await getCurrentUser();

  if (!user) return { denied: NextResponse.json({ error: "Zaloguj się ponownie." }, { status: 401 }) };

  if (!user.canUseAttendance) {
    return { denied: NextResponse.json({ error: "Nie masz dostępu do listy obecności." }, { status: 403 }) };
  }

  if (admin && !user.isAdmin) {
    return { denied: NextResponse.json({ error: "Tylko administrator może to zrobić." }, { status: 403 }) };
  }

  return { user };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
