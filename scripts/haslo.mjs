// Generator hasha hasła do aplikacji.
//
//   node scripts/haslo.mjs "moje-nowe-haslo"
//
// Wynik wklej do .env jako APP_PASSWORD_HASH (lokalnie) albo ustaw
// jako zmienną środowiskową w panelu Vercel (produkcja).

import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error('Użycie: node scripts/haslo.mjs "twoje-haslo"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Hasło musi mieć co najmniej 8 znaków.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");

console.log(`APP_PASSWORD_HASH="scrypt:${salt}:${hash}"`);
