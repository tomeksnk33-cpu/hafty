import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { attendanceUser } from "@/lib/obecnosc/access";

export const dynamic = "force-dynamic";

/** Lista osób do rozpoznawania i kto ma teraz rozpoczętą pracę. */
export async function GET() {
  const { user, denied } = await attendanceUser();
  if (denied) return denied;

  const [people, open] = await Promise.all([
    prisma.attendancePerson.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, aliases: true },
    }),
    prisma.attendanceShift.findMany({
      where: { endedAt: null },
      select: { personId: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    user: { name: user.name, isAdmin: user.isAdmin },
    people,
    open: Object.fromEntries(open.map((s) => [s.personId, s.startedAt])),
  });
}
