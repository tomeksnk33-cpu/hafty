import "dotenv/config";
import { defineConfig } from "prisma/config";

// SHADOW_DATABASE_URL jest potrzebny tylko przy lokalnym `prisma migrate dev`
// (baza z `npm run db:start`). Na Neonie zostaje nieustawiony.
const shadowDatabaseUrl = process.env["SHADOW_DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
