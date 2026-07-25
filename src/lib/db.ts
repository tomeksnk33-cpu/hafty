import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 nie ma już silnika Rust w runtime — połączenie idzie przez adapter
// sterownika. Ten sam adapter obsługuje lokalny Postgres i Neon.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Brak zmiennej DATABASE_URL. Skopiuj .env.example do .env i uzupełnij adres bazy.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// W dev Next przeładowuje moduły przy każdej zmianie pliku. Bez cache'owania
// na globalThis każde przeładowanie tworzyłoby nową pulę połączeń.
const globalForPrisma = globalThis as typeof globalThis & {
  prismaClient?: PrismaClient;
};

export const prisma = globalForPrisma.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = prisma;
}
