import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { LaundryCatalogKind, LaundryUnit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { laundryUser } from "@/lib/pralnia/access";
import { describeDevice } from "@/lib/pralnia/device";
import { mailErrorText } from "@/lib/mail";
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
        qty: z.number().finite().positive().max(100_000),
        unit: z.enum(["szt", "kg", "szt_kg"]).optional(),
        /** Waga dla asortymentu liczonego w sztukach i kilogramach. */
        kg: z.number().finite().nonnegative().max(100_000).optional(),
      }),
    )
    .max(2000)
    .default([]),
});

/** Ostatnie trasy wszystkich pracowników. Tylko dla administratora. */
export async function GET() {
  const { denied } = await laundryUser({ admin: true });
  if (denied) return denied;

  const routes = await prisma.laundryRoute.findMany({
    orderBy: { finishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      workerName: true,
      finishedAt: true,
      mailedAt: true,
      entries: { select: { clientName: true, quantity: true, unit: true, weightKg: true } },
    },
  });

  return NextResponse.json(
    routes.map((r) => ({
      id: r.id,
      worker: r.workerName,
      date: r.finishedAt,
      mailedAt: r.mailedAt,
      count: r.entries.length,
      total: r.entries.filter((e) => e.unit !== LaundryUnit.KG).reduce((sum, e) => sum + e.quantity, 0),
      totalKg:
        Math.round(
          r.entries.reduce((sum, e) => sum + (e.unit === LaundryUnit.KG ? e.quantity : (e.weightKg ?? 0)), 0) * 100,
        ) / 100,
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

    // Jednostka z asortymentu na serwerze; telefon podaje ją na wypadek
    // pozycji usuniętej z listy w trakcie trasy.
    const catalogUnits = new Map(
      (
        await prisma.laundryCatalogEntry.findMany({
          where: { kind: LaundryCatalogKind.ITEM },
          select: { name: true, unit: true },
        })
      ).map((i) => [i.name.toLowerCase(), i.unit]),
    );
    const unitOf = (line: (typeof lines)[number]) =>
      catalogUnits.get(line.item.toLowerCase()) ??
      (line.unit === "kg" ? LaundryUnit.KG : line.unit === "szt_kg" ? LaundryUnit.SZT_KG : LaundryUnit.SZT);

    try {
      saved = await prisma.laundryRoute.create({
        data: {
          id,
          userId: user.id,
          workerName: user.name,
          device: describeDevice(request.headers.get("user-agent"), device),
          finishedAt: date ? new Date(date) : new Date(),
          entries: {
            create: lines.map((line, position) => {
              let unit = unitOf(line);
              // pozycję przestawiono na „szt. i kg” w trakcie trasy, a telefon podał tylko jedną liczbę
              if (unit === LaundryUnit.SZT_KG && line.kg === undefined) {
                unit = line.unit === "kg" ? LaundryUnit.KG : LaundryUnit.SZT;
              }
              const kgOnly = unit === LaundryUnit.KG;
              return {
                position,
                clientName: line.client,
                itemName: line.item,
                unit,
                // kilogramy z dokładnością do 0,01, sztuki w całości
                quantity: kgOnly ? Math.round(line.qty * 100) / 100 : Math.round(line.qty),
                weightKg: unit === LaundryUnit.SZT_KG ? Math.round((line.kg ?? 0) * 100) / 100 : null,
              };
            }),
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

  // ponowną wysyłkę już wysłanego maila może zlecić tylko administrator
  if (!mailedAt || (resend && user.isAdmin)) {
    if (!mailConfigured()) {
      mailError = "Serwer nie ma skonfigurowanej poczty (SMTP).";
    } else {
      try {
        await sendMail(renderRouteMail({ workerName: saved.workerName, device: saved.device, finishedAt: saved.finishedAt, lines: saved.entries }));
        mailedAt = new Date();
        await prisma.laundryRoute.update({ where: { id }, data: { mailedAt } });
      } catch (error) {
        console.error("Wysyłka maila z trasą nieudana:", error);
        mailError = mailErrorText(error);
      }
    }
  }

  return NextResponse.json(
    { saved: true, mailed: Boolean(mailedAt), error: mailError },
    { status: mailError ? 502 : 200 },
  );
}

const DELETE_PASSWORD = "aaa";

/** Usunięcie całej trasy (np. testowej) razem z jej wpisami. Tylko administrator. */
export async function DELETE(request: Request) {
  const { denied } = await laundryUser({ admin: true });
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (!id) return NextResponse.json({ error: "Brak id trasy." }, { status: 400 });
  // Stałe hasło chroni przed przypadkowym kliknięciem (to nie zabezpieczenie konta).
  if (request.headers.get("x-haslo-usuniecia") !== DELETE_PASSWORD) {
    return NextResponse.json({ error: "Złe hasło. Trasa nie została usunięta." }, { status: 403 });
  }

  const { count } = await prisma.laundryRoute.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "Tej trasy już nie ma." }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
