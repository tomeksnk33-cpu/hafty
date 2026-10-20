import "server-only";

import { prisma } from "@/lib/db";
import { formatDateShort } from "@/lib/format";

export type RealizationOption = { id: string; label: string };

/** Tyle najnowszych realizacji mieści się na liście wyboru — resztę znajdzie wyszukiwarka w formularzu. */
const LIMIT = 500;

/**
 * Realizacje do wyboru we wpisie dziennika, od najnowszych. Przy edycji wpisu
 * dokładamy tę, do której należy, nawet jeśli jest starsza niż limit.
 */
export async function loadRealizationOptions(
  alwaysInclude?: string | null,
): Promise<RealizationOption[]> {
  const select = {
    id: true,
    name: true,
    executedAt: true,
    client: { select: { name: true } },
  } as const;

  const [recent, pinned] = await Promise.all([
    prisma.realization.findMany({
      orderBy: [{ executedAt: "desc" }, { createdAt: "desc" }],
      take: LIMIT,
      select,
    }),
    alwaysInclude
      ? prisma.realization.findUnique({ where: { id: alwaysInclude }, select })
      : Promise.resolve(null),
  ]);

  const rows =
    pinned && !recent.some((row) => row.id === pinned.id) ? [...recent, pinned] : recent;

  return rows.map((row) => ({
    id: row.id,
    label: [row.name, row.client?.name, formatDateShort(row.executedAt)]
      .filter(Boolean)
      .join(" · "),
  }));
}
