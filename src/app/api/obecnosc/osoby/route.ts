import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { attendanceUser, readJson } from "@/lib/obecnosc/access";

const name = z.string().trim().min(1, "Podaj imię i nazwisko.").max(100);
const aliases = z.array(z.string().trim().min(1).max(100)).max(20).default([]);

const createSchema = z.object({ name, aliases });
const updateSchema = z.object({ id: z.string().min(1), name, aliases, active: z.boolean().optional() });

const bad = (error: z.ZodError) =>
  NextResponse.json({ error: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });

/** Wszystkie osoby z listy, także wyłączone (dla administratora). */
export async function GET() {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const people = await prisma.attendancePerson.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, aliases: true, active: true, _count: { select: { shifts: true } } },
  });

  return NextResponse.json(people.map(({ _count, ...p }) => ({ ...p, shifts: _count.shifts })));
}

export async function POST(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return bad(parsed.error);

  const person = await prisma.attendancePerson.create({ data: parsed.data });
  return NextResponse.json(person, { status: 201 });
}

export async function PUT(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return bad(parsed.error);

  const { id, ...data } = parsed.data;
  const found = await prisma.attendancePerson.findUnique({ where: { id }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Nie ma takiej osoby." }, { status: 404 });

  return NextResponse.json(await prisma.attendancePerson.update({ where: { id }, data }));
}

/** Osobę z zapisanymi godzinami tylko się wyłącza, żeby grafik się nie zmienił. */
export async function DELETE(request: Request) {
  const { denied } = await attendanceUser({ admin: true });
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const person = await prisma.attendancePerson.findUnique({
    where: { id },
    select: { _count: { select: { shifts: true } } },
  });
  if (!person) return NextResponse.json({ error: "Nie ma takiej osoby." }, { status: 404 });

  if (person._count.shifts > 0) {
    await prisma.attendancePerson.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ deactivated: true });
  }

  await prisma.attendancePerson.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
