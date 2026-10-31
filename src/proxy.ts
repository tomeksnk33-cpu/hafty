import { NextResponse, type NextRequest } from "next/server";

import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

// W Next 16 `middleware.ts` nazywa się `proxy.ts`, a eksportowana funkcja `proxy`.
//
// To tylko szybka bramka: sprawdza podpis ciasteczka, bez zaglądania do bazy.
// Rola i aktywność konta są sprawdzane w każdej stronie i akcji (lib/auth.ts).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (await readSessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const wanted = request.nextUrl.pathname + request.nextUrl.search;

  // Zapamiętujemy tylko ścieżki wewnętrzne — inaczej parametr `powrot` byłby
  // otwartym przekierowaniem na dowolną domenę.
  if (wanted !== "/" && wanted.startsWith("/") && !wanted.startsWith("//")) {
    loginUrl.searchParams.set("powrot", wanted);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Wszystko poza ekranem logowania, zasobami Next i plikami z public/.
    // Manifest i ikony trasy pralni przeglądarka pobiera bez ciasteczka, przy
    // dodawaniu aplikacji do ekranu głównego.
    "/((?!login|_next/static|_next/image|uploads/|favicon.ico|pralnia/manifest\\.webmanifest|pralnia/icon).*)",
  ],
};
