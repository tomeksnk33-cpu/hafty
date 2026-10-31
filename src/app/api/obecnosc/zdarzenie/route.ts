import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { attendanceUser, readJson } from "@/lib/obecnosc/access";
import { mailAttendance } from "@/lib/obecnosc/mail";
import { describeDevice } from "@/lib/pralnia/device";

const schema = z.object({
  personId: z.string().min(1).max(64),
  type: z.enum(["start", "end"]),
  device: z
    .object({
      model: z.string().max(100).optional(),
      platform: z.string().max(100).optional(),
      platformVersion: z.string().max(100).optional(),
    })
    .optional(),
});

const warsawDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

/**
 * „Rozpoczynam pracę” otwiera okres pracy, „kończę pracę” go zamyka. Każde
 * zdarzenie wysyła mail. Godzinę ustala serwer, nie urządzenie.
 */
export async function POST(request: Request) {
  const { denied } = await attendanceUser();
  if (denied) return denied;

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const { personId, type } = parsed.data;
  const person = await prisma.attendancePerson.findFirst({ where: { id: personId, active: true } });
  if (!person) return NextResponse.json({ error: "Nie ma takiej osoby na liście." }, { status: 404 });

  const device = describeDevice(request.headers.get("user-agent"), parsed.data.device);
  const now = new Date();
  const open = await prisma.attendanceShift.findFirst({
    where: { personId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (type === "start") {
    // Drugie „rozpoczynam” tego samego dnia nic nie zmienia. Niezamknięty
    // okres z poprzedniego dnia zostaje do poprawienia w grafiku.
    if (open && warsawDay(open.startedAt) === warsawDay(now)) {
      return NextResponse.json({ status: "already", name: person.name, startedAt: open.startedAt });
    }

    const shift = await prisma.attendanceShift.create({
      data: { personId, startedAt: now, startDevice: device },
    });
    const mailError = await mailAttendance({ type, name: person.name, startedAt: shift.startedAt, device });

    return NextResponse.json({
      status: "ok",
      name: person.name,
      startedAt: shift.startedAt,
      forgotten: open ? open.startedAt : null,
      mailError,
    });
  }

  if (!open) return NextResponse.json({ status: "notStarted", name: person.name });

  const shift = await prisma.attendanceShift.update({
    where: { id: open.id },
    data: { endedAt: now, endDevice: device },
  });
  const mailError = await mailAttendance({
    type,
    name: person.name,
    startedAt: shift.startedAt,
    endedAt: shift.endedAt,
    device,
  });

  return NextResponse.json({
    status: "ok",
    name: person.name,
    startedAt: shift.startedAt,
    endedAt: shift.endedAt,
    mailError,
  });
}
