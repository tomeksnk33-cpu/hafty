import "server-only";
import "./tz";

import nodemailer from "nodemailer";

import { buildReport } from "../../../public/rejestrator/core.js";

import { getSettings, localDay, reportData } from "./data";
import { HttpError } from "./errors";
import { deleteValue, setValue, setValueIfAbsent } from "./store";

// Raport dnia przez SMTP — te same zmienne SMTP_* co mail z trasy pralni.
// SMTP_SECURITY (ssl / starttls / brak) jest opcjonalne; domyślnie port 465 = ssl,
// każdy inny = starttls.

export function smtpConfig() {
  const e = process.env;
  const port = Number(e.SMTP_PORT || 465);
  const security = (e.SMTP_SECURITY || (port === 465 ? "ssl" : "starttls")).toLowerCase();
  return {
    host: e.SMTP_HOST || "", port, security,
    user: e.SMTP_USER || "", pass: e.SMTP_PASS || "", from: e.MAIL_FROM || e.SMTP_USER || "",
  };
}

export const smtpReady = () => {
  const c = smtpConfig();
  return !!(c.host && c.from);
};

export async function mailStatus() {
  const s = await getSettings();
  return {
    smtp: smtpReady(), recipients: s.recipients, time: s.time, enabled: s.enabled,
    configured: smtpReady() && s.recipients.length > 0,
  };
}

async function send(day: string) {
  const s = await getSettings();
  if (!smtpReady()) {
    throw new HttpError(400, "Poczta nie jest skonfigurowana: uzupełnij zmienne SMTP_HOST, SMTP_USER, SMTP_PASS w ustawieniach projektu w Vercel.");
  }
  if (!s.recipients.length) throw new HttpError(400, "Brak odbiorców raportu. Kierownik może ich wpisać w zakładce „Raport”.");
  const c = smtpConfig();
  const r = buildReport(day, await reportData(day));
  const transport = nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.security === "ssl", ignoreTLS: c.security === "brak",
    requireTLS: c.security === "starttls", auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 20_000,
  });
  await transport.sendMail({
    from: c.from, to: s.recipients.join(", "), subject: r.subject, text: r.text, html: r.html,
    attachments: [{ filename: r.filename, content: "﻿" + r.csv, contentType: "text/csv; charset=utf-8" }],
  });
  return "wysłano do: " + s.recipients.join(", ");
}

export const sendReport = (day: string) => send(day);

// raport automatyczny z dzisiaj: wysyła go pierwsze urządzenie (albo zadanie cron Vercel),
// które zgłosi się po ustawionej godzinie; pozostałe dostaną "już wysłany"
export async function sendDueReport() {
  const s = await getSettings();
  const day = localDay();
  const [h, m] = s.time.split(":").map(Number);
  const due = new Date();
  due.setHours(h, m, 0, 0);
  if (!s.enabled || !smtpReady() || !s.recipients.length) return { sent: false, reason: "wyłączony albo nieskonfigurowany" };
  if (Date.now() < due.getTime()) return { sent: false, reason: "jeszcze nie pora" };
  const k = "sent:" + day;
  if (!(await setValueIfAbsent(k, "sending", 600))) return { sent: false, reason: "raport z dzisiaj już wysłany" };
  try {
    const message = await send(day);
    await setValue(k, "done", 3 * 86_400);
    return { sent: true, message };
  } catch (e) {
    await deleteValue(k); // następna próba przy kolejnym zgłoszeniu
    throw e;
  }
}
