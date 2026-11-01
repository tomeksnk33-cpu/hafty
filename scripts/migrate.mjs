// Migracje bazy przy budowaniu na Vercelu.
//
// - Podglądy (Preview) korzystają z tej samej bazy co produkcja, więc migracje
//   uruchamia tylko wdrożenie produkcyjne (i lokalne `npm run build`).
// - Bez blokady doradczej (advisory lock): przez pooler Neona (PgBouncer)
//   blokada potrafi „zawisnąć” na połączeniu i kolejne budowania kończą się
//   błędem P1002. Migracje i tak uruchamia naraz tylko jedno wdrożenie.
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`Pomijam migracje bazy (VERCEL_ENV=${env}); uruchamia je tylko wdrożenie produkcyjne.`);
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" },
});
process.exit(result.status ?? 1);
