import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { attendanceUser, readJson } from "@/lib/obecnosc/access";

const times = {
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
};
const createSchema = z.object({ personId: z.string().min(1), ...times });
const updateSchema = z.object({ id: z.string().min(1), ...times });

function checkTimes(startedAt: string, endedAt: string | null) {
  if (endedAt && new Date(endedAt) <= new Date(startedAt)) return "Zakończenie musi być po rozpoczęciu.";
  if (endedAt && new Date(endedAt).getTime() - new Date(startedAt).getTime() > 24 * 3600 * 1000) {
    return "Okres pracy nie może trwać dłużej niż dobę.";
  }
  return null;
}

/** Ręczne dopisanie godzin, np. gdy ktoś zapomniał się zgłosić. */
export async function POST(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const { personId, startedAt, endedAt } = parsed.data;
  const problem = checkTimes(startedAt, endedAt);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const person = await prisma.attendancePerson.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) return NextResponse.json({ error: "Nie ma takiej osoby." }, { status: 404 });

  const shift = await prisma.attendanceShift.create({
    data: { personId, startedAt: new Date(startedAt), endedAt: endedAt ? new Date(endedAt) : null, edited: true },
  });
  return NextResponse.json(shift, { status: 201 });
}

/** Poprawka godzin wpisu. */
export async function PUT(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const { id, startedAt, endedAt } = parsed.data;
  const problem = checkTimes(startedAt, endedAt);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const found = await prisma.attendanceShift.findUnique({ where: { id }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Nie ma takiego wpisu." }, { status: 404 });

  const shift = await prisma.attendanceShift.update({
    where: { id },
    data: { startedAt: new Date(startedAt), endedAt: endedAt ? new Date(endedAt) : null, edited: true },
  });
  return NextResponse.json(shift);
}

export async function DELETE(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const { count } = await prisma.attendanceShift.deleteMany({ where: { id } });
  if (!count) return NextResponse.json({ error: "Nie ma takiego wpisu." }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
