export type Unit = "SZT" | "KG";
export type RouteLine = { clientName: string; itemName: string; quantity: number; unit?: Unit };

/** „12,5 kg” albo „20 szt.” */
export function formatQty(quantity: number, unit: Unit = "SZT") {
  const n = quantity.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  return unit === "KG" ? `${n} kg` : `${n} szt.`;
}

type Totals = Map<string, { quantity: number; unit: Unit }>;

function add(map: Totals, line: RouteLine) {
  const unit = line.unit ?? "SZT";
  // ta sama nazwa w dwóch jednostkach (zmiana w asortymencie) liczy się osobno
  const key = `${line.itemName}\u0000${unit}`;
  const cur = map.get(key) ?? { quantity: 0, unit };
  cur.quantity = Math.round((cur.quantity + line.quantity) * 100) / 100;
  map.set(key, cur);
}

export const itemName = (key: string) => key.split("\u0000")[0];

/** Grupuje wpisy trasy po kliencie i asortymencie, w kolejności pierwszego wystąpienia. */
export function summarize(lines: RouteLine[]) {
  const byClient = new Map<string, Totals>();
  const totals: Totals = new Map();

  for (const line of lines) {
    const items = byClient.get(line.clientName) ?? new Map();
    add(items, line);
    byClient.set(line.clientName, items);
    add(totals, line);
  }

  return { byClient, totals };
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Treść maila z podsumowaniem trasy: każdy klient osobno i suma całej trasy. */
export function renderRouteMail({
  workerName,
  device,
  finishedAt,
  lines,
}: {
  workerName: string;
  device?: string | null;
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

  const from = device || "nieznane";

  let text = `Podsumowanie trasy – ${when}\nPracownik: ${worker}\nWysłano z urządzenia: ${from}\n\n`;
  let html = `<h2 style="margin:0 0 4px">Podsumowanie trasy</h2><p style="margin:0 0 12px;color:#555">${esc(when)} · Pracownik: <b>${esc(worker)}</b><br>Wysłano z urządzenia: <b>${esc(from)}</b></p>`;
  html += `<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">`;

  for (const [client, items] of byClient) {
    text += `${client}\n`;
    html += `<tr><td colspan="2" style="background:#eef3fa;font-weight:bold">${esc(client)}</td></tr>`;
    for (const [key, { quantity, unit }] of items) {
      text += `  - ${itemName(key)}: ${formatQty(quantity, unit)}\n`;
      html += `<tr><td style="padding-left:18px;border-bottom:1px solid #eee">${esc(itemName(key))}</td><td align="right" style="border-bottom:1px solid #eee">${esc(formatQty(quantity, unit))}</td></tr>`;
    }
    text += "\n";
  }

  text += "RAZEM:\n";
  html += `<tr><td colspan="2" style="background:#1f5fa8;color:#fff;font-weight:bold">RAZEM</td></tr>`;
  for (const [key, { quantity, unit }] of totals) {
    text += `  - ${itemName(key)}: ${formatQty(quantity, unit)}\n`;
    html += `<tr><td style="padding-left:18px">${esc(itemName(key))}</td><td align="right"><b>${esc(formatQty(quantity, unit))}</b></td></tr>`;
  }
  html += "</table>";

  return { subject, text, html };
}
