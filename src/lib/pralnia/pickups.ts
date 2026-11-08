import "server-only";

import { LaundryCatalogKind, LaundryPickupSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { mailConfigured, sendMail } from "@/lib/pralnia/mail";
import { formatPhone } from "@/lib/pralnia/phone";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Klient pralni, do którego należy numer, albo null. */
export async function clientByPhone(phone: string) {
  return prisma.laundryCatalogEntry.findFirst({
    where: { kind: LaundryCatalogKind.CLIENT, phones: { has: phone } },
    select: { id: true, name: true },
  });
}

/**
 * Zapisuje zgłoszenie z SMS-a i wysyła mail o nim (jeśli poczta jest ustawiona).
 * Błąd poczty nie gubi zgłoszenia — ono i tak jest już na liście „Do odebrania".
 */
export async function savePickupFromSms(phone: string, message: string) {
  const client = await clientByPhone(phone);
  const pickup = await prisma.laundryPickup.create({
    data: {
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
      phone,
      message: message.slice(0, 1000) || null,
      source: LaundryPickupSource.SMS,
    },
  });

  if (mailConfigured()) {
    const who = client ? client.name : `nieznany numer ${formatPhone(phone)}`;
    const subject = `Odbiór prania: ${client ? client.name : formatPhone(phone)}`;
    const text = `SMS od: ${who}\nTreść: ${message || "(pusta)"}\n\nZgłoszenie jest na liście „Do odebrania" w zakładce Trasa.`;
    const html = `<p>SMS od: <b>${esc(who)}</b></p><p>Treść: ${esc(message || "(pusta)")}</p><p>Zgłoszenie jest na liście „Do odebrania” w zakładce Trasa.</p>`;
    try {
      await sendMail({ subject, text, html });
    } catch (error) {
      console.error("Mail o zgłoszeniu odbioru nie wyszedł:", error);
    }
  }

  return pickup;
}
