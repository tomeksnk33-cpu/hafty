import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser, type SessionUser } from "@/lib/auth";

/**
 * Zalogowana osoba z dostępem do trasy pralni albo gotowa odpowiedź z błędem:
 * 401, gdy sesja wygasła (telefon pokaże „Zaloguj się ponownie"), 403, gdy
 * konto nie ma uprawnienia do pralni (albo, przy `admin`, nie jest administratorem).
 */
export async function laundryUser({ admin = false } = {}): Promise<
  { user: SessionUser; denied?: never } | { user?: never; denied: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return { denied: NextResponse.json({ error: "Zaloguj się ponownie." }, { status: 401 }) };
  }

  if (!user.canUseLaundry) {
    return {
      denied: NextResponse.json({ error: "Nie masz dostępu do trasy pralni." }, { status: 403 }),
    };
  }

  if (admin && !user.isAdmin) {
    return {
      denied: NextResponse.json({ error: "To może zrobić tylko administrator." }, { status: 403 }),
    };
  }

  return { user };
}
