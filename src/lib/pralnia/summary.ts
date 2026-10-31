export type RouteLine = { clientName: string; itemName: string; quantity: number };

/** Grupuje wpisy trasy po kliencie i asortymencie, w kolejności pierwszego wystąpienia. */
export function summarize(lines: RouteLine[]) {
  const byClient = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();

  for (const line of lines) {
    const items = byClient.get(line.clientName) ?? new Map<string, number>();
    items.set(line.itemName, (items.get(line.itemName) ?? 0) + line.quantity);
    byClient.set(line.clientName, items);
    totals.set(line.itemName, (totals.get(line.itemName) ?? 0) + line.quantity);
  }

  return { byClient, totals };
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Treść maila z podsumowaniem trasy: każdy klient osobno i suma całej trasy. */
export function renderRouteMail({
  workerName,
  finishedAt,
  lines,
}: {
  workerName: string;
  finishedAt: Date;
  lines: RouteLine[];
}) {
  const { byClient, totals } = summarize(lines);
  const worker = workerName || "—";
  const when = finishedAt.toLocaleString("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  });
  const day = finishedAt.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" });
  const subject = `Trasa ${workerName || "pracownika"} – ${day}`;

  let text = `Podsumowanie trasy – ${when}\nPracownik: ${worker}\n\n`;
  let html = `<h2 style="margin:0 0 4px">Podsumowanie trasy</h2><p style="margin:0 0 12px;color:#555">${esc(when)} · Pracownik: <b>${esc(worker)}</b></p>`;
  html += `<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">`;

  for (const [client, items] of byClient) {
    text += `${client}\n`;
    html += `<tr><td colspan="2" style="background:#eef3fa;font-weight:bold">${esc(client)}</td></tr>`;
    for (const [item, qty] of items) {
      text += `  - ${item}: ${qty} szt.\n`;
      html += `<tr><td style="padding-left:18px;border-bottom:1px solid #eee">${esc(item)}</td><td align="right" style="border-bottom:1px solid #eee">${qty}</td></tr>`;
    }
    text += "\n";
  }

  text += "RAZEM:\n";
  html += `<tr><td colspan="2" style="background:#1f5fa8;color:#fff;font-weight:bold">RAZEM</td></tr>`;
  for (const [item, qty] of totals) {
    text += `  - ${item}: ${qty} szt.\n`;
    html += `<tr><td style="padding-left:18px">${esc(item)}</td><td align="right"><b>${qty}</b></td></tr>`;
  }
  html += "</table>";

  return { subject, text, html };
}
