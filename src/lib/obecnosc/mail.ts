import "server-only";

import { mailConfigured, sendMail } from "@/lib/pralnia/mail";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const time = (d: Date) => d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
const date = (d: Date) => d.toLocaleDateString("pl-PL", { dateStyle: "long", timeZone: "Europe/Warsaw" });

/** „7 h 45 min” */
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/**
 * Mail o rozpoczęciu albo zakończeniu pracy. Zwraca opis błędu albo null.
 * Błąd poczty nie cofa zapisu obecności.
 */
export async function mailAttendance({
  type,
  name,
  startedAt,
  endedAt,
  device,
}: {
  type: "start" | "end";
  name: string;
  startedAt: Date;
  endedAt?: Date | null;
  device?: string | null;
}): Promise<string | null> {
  if (!mailConfigured()) return "Serwer nie ma skonfigurowanej poczty (SMTP).";

  const at = type === "start" ? startedAt : endedAt!;
  const action = type === "start" ? "rozpoczął(a) pracę" : "zakończył(a) pracę";
  const subject = `Obecność Brzozów: ${name} ${action} o ${time(at)}`;

  const rows: [string, string][] = [
    ["Pracownik", name],
    ["Data", date(at)],
    ["Rozpoczęcie pracy", time(startedAt)],
  ];
  if (type === "end" && endedAt) {
    rows.push(["Zakończenie pracy", time(endedAt)]);
    rows.push(["Czas pracy", formatDuration(endedAt.getTime() - startedAt.getTime())]);
  }
  rows.push(["Wysłano z urządzenia", device || "nieznane"]);

  const text = `Lista Obecności Brzozów\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`;
  const html =
    `<h2 style="margin:0 0 10px;font-family:sans-serif">Lista Obecności Brzozów</h2>` +
    `<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
    rows
      .map(([k, v]) => `<tr><td style="color:#555;border-bottom:1px solid #eee">${esc(k)}</td><td style="border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`)
      .join("") +
    `</table>`;

  try {
    await sendMail({ subject, text, html });
    return null;
  } catch (error) {
    console.error("Wysyłka maila z listy obecności nieudana:", error);
    return "Nie udało się wysłać maila: " + (error instanceof Error ? error.message : String(error));
  }
}
