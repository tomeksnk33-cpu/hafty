import "server-only";

import { prisma } from "@/lib/db";

// Drobne wartości i numery wersji rejestratora w tabelach RcpSetting i RcpVersion.

export async function getValue(key: string) {
  const row = await prisma.rcpSetting.findUnique({ where: { key } });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await prisma.rcpSetting.deleteMany({ where: { key, expiresAt: row.expiresAt } });
    return null;
  }
  return row.value;
}

export async function setValue(key: string, value: string, ttlSeconds?: number) {
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  await prisma.rcpSetting.upsert({ where: { key }, create: { key, value, expiresAt }, update: { value, expiresAt } });
}

/** Zapis tylko wtedy, gdy klucza nie ma (albo wygasł). Zwraca, czy się udało. */
export async function setValueIfAbsent(key: string, value: string, ttlSeconds?: number) {
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  await prisma.rcpSetting.deleteMany({ where: { key, expiresAt: { lt: new Date() } } });
  const inserted = await prisma.$executeRaw`
    INSERT INTO "RcpSetting" ("key", "value", "expiresAt") VALUES (${key}, ${value}, ${expiresAt})
    ON CONFLICT ("key") DO NOTHING`;
  return inserted === 1;
}

export async function deleteValue(key: string) {
  await prisma.rcpSetting.deleteMany({ where: { key } });
}

/** Licznik z czasem życia liczonym od pierwszego zwiększenia (np. błędne hasła z jednego IP). */
export async function increment(key: string, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    INSERT INTO "RcpSetting" ("key", "value", "expiresAt") VALUES (${key}, '1', ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "value" = CASE WHEN "RcpSetting"."expiresAt" < now() THEN '1'
                     ELSE (("RcpSetting"."value")::int + 1)::text END,
      "expiresAt" = CASE WHEN "RcpSetting"."expiresAt" < now() THEN EXCLUDED."expiresAt"
                         ELSE "RcpSetting"."expiresAt" END
    RETURNING "value"`;
  return Number(rows[0]?.value ?? 1);
}

/** Zwiększa numery wersji, żeby inne urządzenia pobrały zmienione dane. */
export async function bump(...keys: string[]) {
  for (const key of new Set(keys)) {
    await prisma.$executeRaw`
      INSERT INTO "RcpVersion" ("key", "value") VALUES (${key}, 1)
      ON CONFLICT ("key") DO UPDATE SET "value" = "RcpVersion"."value" + 1`;
  }
}

export const dayKey = (day: string) => "day:" + day;

export async function versions(keys: string[]) {
  const rows = await prisma.rcpVersion.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
