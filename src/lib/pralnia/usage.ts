import "server-only";

import { prisma } from "@/lib/db";

/**
 * Jak często obsługujemy klientów i co u nich pierzemy — do ułożenia przycisków
 * na ekranie dotykowym. Wpisy tras trzymają nazwy z chwili trasy, więc liczymy
 * po nazwach (porównanie bez wielkości liter).
 */
export async function laundryUsage() {
  const [routesByClient, itemsByClient, prices] = await Promise.all([
    // jedna para klient+trasa = jedna wizyta
    prisma.laundryRouteEntry.groupBy({ by: ["clientName", "routeId"] }),
    prisma.laundryRouteEntry.groupBy({ by: ["clientName", "itemName"], _count: { _all: true } }),
    prisma.laundryPrice.findMany({ select: { clientId: true, itemId: true } }),
  ]);

  const key = (s: string) => s.trim().toLocaleLowerCase("pl");

  const visits = new Map<string, number>();
  for (const r of routesByClient) visits.set(key(r.clientName), (visits.get(key(r.clientName)) ?? 0) + 1);

  /** klient -> asortyment -> liczba wpisów */
  const items = new Map<string, Map<string, number>>();
  for (const r of itemsByClient) {
    const c = key(r.clientName);
    if (!items.has(c)) items.set(c, new Map());
    const m = items.get(c)!;
    m.set(key(r.itemName), (m.get(key(r.itemName)) ?? 0) + r._count._all);
  }

  /** id klienta -> id asortymentu z ceną w cenniku */
  const priced = new Map<string, Set<string>>();
  for (const p of prices) {
    if (!priced.has(p.clientId)) priced.set(p.clientId, new Set());
    priced.get(p.clientId)!.add(p.itemId);
  }

  return {
    visits: (clientName: string) => visits.get(key(clientName)) ?? 0,
    /**
     * Asortyment klienta: pozycje, które już mu woziliśmy, i te z ceną w cenniku,
     * najczęstsze najpierw.
     */
    clientItems(client: { id: string; name: string }, catalogItems: { id: string; name: string }[]) {
      const used = items.get(key(client.name));
      const withPrice = priced.get(client.id);
      return catalogItems
        .map((it) => ({ id: it.id, name: it.name, n: used?.get(key(it.name)) ?? 0, p: withPrice?.has(it.id) ?? false }))
        .filter((it) => it.n > 0 || it.p)
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "pl"))
        .map((it) => it.id);
    },
    /** Ile razy pozycja była w trasach (wszyscy klienci). */
    itemTotal(itemName: string) {
      let n = 0;
      for (const m of items.values()) n += m.get(key(itemName)) ?? 0;
      return n;
    },
  };
}
