import "server-only";

import { LaundryUnit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export const unitOut = (unit: LaundryUnit) =>
  unit === LaundryUnit.KG ? "kg" : unit === LaundryUnit.SZT_KG ? "szt_kg" : "szt";

export const unitIn = (unit: "szt" | "kg" | "szt_kg" | undefined) =>
  unit === "kg" ? LaundryUnit.KG : unit === "szt_kg" ? LaundryUnit.SZT_KG : LaundryUnit.SZT;

const r2 = (n: number) => Math.round(n * 100) / 100;

export type StockRow = { client: string; item: string; unit: "szt" | "kg" | "szt_kg"; qty: number; kg: number };

/** Stan magazynu czystego prania: klient + asortyment + jednostka, bez zerowych pozycji. */
export async function currentStock(where: { clientName?: string; itemName?: string; unit?: LaundryUnit } = {}) {
  const groups = await prisma.laundryStockMove.groupBy({
    by: ["clientName", "itemName", "unit"],
    where,
    _sum: { quantity: true, weightKg: true },
  });

  return groups
    .map(
      (g): StockRow => ({
        client: g.clientName,
        item: g.itemName,
        unit: unitOut(g.unit),
        qty: r2(g._sum.quantity ?? 0),
        kg: r2(g._sum.weightKg ?? 0),
      }),
    )
    .filter((s) => s.qty !== 0 || s.kg !== 0)
    .sort((a, b) => a.client.localeCompare(b.client, "pl") || a.item.localeCompare(b.item, "pl"));
}
