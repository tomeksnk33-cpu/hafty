import "dotenv/config";
import { defineConfig } from "prisma/config";

// SHADOW_DATABASE_URL jest potrzebny tylko przy lokalnym `prisma migrate dev`
// (baza z `npm run db:start`). Na Neonie zostaje nieustawiony.
const shadowDatabaseUrl = process.env["SHADOW_DATABASE_URL"];

// Polecenia Prisma (migracje) łączą się bezpośrednio z bazą, z pominięciem
// poolera, jeśli integracja Neona w Vercelu podała taki adres. Aplikacja
// (src/lib/db.ts) dalej używa DATABASE_URL.
const directUrl =
  process.env["DATABASE_URL_UNPOOLED"] || process.env["POSTGRES_URL_NON_POOLING"] || process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
