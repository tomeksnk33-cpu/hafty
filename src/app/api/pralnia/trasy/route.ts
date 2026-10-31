import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";
import { describeDevice } from "@/lib/pralnia/device";
import { mailConfigured, sendMail } from "@/lib/pralnia/mail";
import { renderRouteMail } from "@/lib/pralnia/summary";

const routeSchema = z.object({
  id: z.string().trim().min(1).max(64),
  /** Ponowna wysyłka maila dla już zapisanej trasy. */
  resend: z.boolean().optional(),
  date: z.iso.datetime().optional(),
  /** Podpowiedzi o modelu telefonu z navigator.userAgentData (Chrome na Androidzie). */
  device: z
    .object({
      model: z.string().max(100).optional(),
      platform: z.string().max(100).optional(),
      platformVersion: z.string().max(100).optional(),
    })
    .optional(),
  route: z
    .array(
      z.object({
        client: z.string().trim().min(1).max(120),
        item: z.string().trim().min(1).max(120),
        qty: z.number().finite().positive(),
      }),
    )
    .max(2000)
    .default([]),
});

/** Ostatnie trasy wszystkich pracowników. */
export async function GET() {
  const { denied } = await laundryUser();
  if (denied) return denied;

  const routes = await prisma.laundryRoute.findMany({
    orderBy: { finishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      workerName: true,
      finishedAt: true,
      mailedAt: true,
      entries: { select: { clientName: true, quantity: true } },
    },
  });

  return NextResponse.json(
    routes.map((r) => ({
      id: r.id,
      worker: r.workerName,
      date: r.finishedAt,
      mailedAt: r.mailedAt,
      count: r.entries.length,
      total: r.entries.reduce((sum, e) => sum + e.quantity, 0),
      clients: new Set(r.entries.map((e) => e.clientName)).size,
    })),
  );
}

/**
 * Zapisuje zakończoną trasę i wysyła mail z podsumowaniem. Idempotentne po id
 * trasy nadanym przez telefon: ponowienie po zerwanym połączeniu nie tworzy
 * duplikatu ani drugiego maila.
 */
export async function POST(request: Request) {
  const { user, denied } = await laundryUser();
  if (denied) return denied;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {}

  const parsed = routeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane trasy." }, { status: 400 });

  const { id, resend, date, device, route: lines } = parsed.data;

  let saved = await prisma.laundryRoute.findUnique({
    where: { id },
    include: { entries: { orderBy: { position: "asc" } } },
  });

  if (!saved) {
    if (lines.length === 0) return NextResponse.json({ error: "Pusta trasa." }, { status: 400 });

    try {
      saved = await prisma.laundryRoute.create({
        data: {
          id,
          userId: user.id,
          workerName: user.name,
          device: describeDevice(request.headers.get("user-agent"), device),
          finishedAt: date ? new Date(date) : new Date(),
          entries: {
            create: lines.map((line, position) => ({
              position,
              clientName: line.client,
              itemName: line.item,
              quantity: Math.round(line.qty),
            })),
          },
        },
        include: { entries: { orderBy: { position: "asc" } } },
      });
    } catch (error) {
      // Dwa równoległe wysłania tej samej trasy — drugie trafia na istniejące id.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      saved = await prisma.laundryRoute.findUniqueOrThrow({
        where: { id },
        include: { entries: { orderBy: { position: "asc" } } },
      });
    }
  }

  let mailError: string | null = null;
  let mailedAt = saved.mailedAt;

  if (!mailedAt || resend) {
    if (!mailConfigured()) {
      mailError = "Serwer nie ma skonfigurowanej poczty (SMTP).";
    } else {
      try {
        await sendMail(renderRouteMail({ workerName: saved.workerName, device: saved.device, finishedAt: saved.finishedAt, lines: saved.entries }));
        mailedAt = new Date();
        await prisma.laundryRoute.update({ where: { id }, data: { mailedAt } });
      } catch (error) {
        console.error("Wysyłka maila z trasą nieudana:", error);
        mailError = "Nie udało się wysłać maila: " + (error instanceof Error ? error.message : String(error));
      }
    }
  }

  return NextResponse.json(
    { saved: true, mailed: Boolean(mailedAt), error: mailError },
    { status: mailError ? 502 : 200 },
  );
}
