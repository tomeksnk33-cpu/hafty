import { NextResponse } from "next/server";

import { endSession } from "@/lib/auth";

// Wylogowanie z aplikacji statycznych (np. /pralnia), które nie mają akcji serwera.
export async function POST() {
  await endSession();
  return NextResponse.json({ ok: true });
}
