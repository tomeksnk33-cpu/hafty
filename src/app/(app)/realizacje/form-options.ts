import "server-only";

import { prisma } from "@/lib/db";

/** Dane potrzebne formularzowi realizacji: lista klientów i już użyte typy produktów. */
export async function loadFormOptions() {
  const [clients, types] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.realization.findMany({
      where: { productType: { not: null } },
      distinct: ["productType"],
      orderBy: { productType: "asc" },
      select: { productType: true },
    }),
  ]);

  return {
    clients,
    productTypes: types
      .map((row) => row.productType)
      .filter((type): type is string => Boolean(type)),
  };
}
