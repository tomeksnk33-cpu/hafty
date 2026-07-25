# Baza haftów

Archiwum wykonanych haftów: realizacje ze zdjęciami, klienci, katalog nici,
wyszukiwarka i podsumowania. Cała aplikacja jest za jednym hasłem.

## Co jest w środku

- **Realizacje** — nazwa, data wykonania, klient, typ produktu, wymiary,
  liczba ściegów, ilość sztuk, cena, zdjęcia, plik maszynowy (.dst/.pes/…),
  użyte nici i notatki.
- **Klienci** — kartoteka plus strona podsumowania: liczba realizacji, sztuki,
  suma kwot, okres współpracy i najczęściej używane nici.
- **Katalog nici** — producent + numer (unikalne), nazwa koloru, podgląd
  koloru; przy każdej nici lista realizacji, w których jej użyto.
- **Nici oznaczone na zdjęciu** — do realizacji można przypiąć dowolnie wiele
  nici i wskazać klikiem, w którym miejscu zdjęcia której użyto. Nici dostają
  numery 1, 2, 3…, te same na znacznikach i na liście pod zdjęciem, a najechanie
  na nić podświetla jej znaczniki. Rozwiązuje to problem nici o zbliżonych
  kolorach, nierozróżnialnych na fotografii.
- **Historia z wyszukiwarką** — jedna fraza przeszukuje nazwy realizacji,
  klientów i nici; do tego filtry po kliencie, nici, typie produktu i zakresie dat.
- **Podsumowanie miesięczne** — wartość, liczba realizacji i sztuk w rozbiciu na
  miesiące wybranego roku, z przejściem z każdego miesiąca do przefiltrowanej
  historii. Realizacje bez ceny są liczone, ale nie wchodzą do kwoty i strona
  wprost to sygnalizuje.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 7 + PostgreSQL ·
Vercel Blob na pliki · sesja na podpisanym ciasteczku (jose).

## Uruchomienie lokalne

Wymagany Node.js 20.9+ i PostgreSQL.

```bash
npm install
```

Skopiuj `.env.example` do `.env` i uzupełnij:

- `DATABASE_URL` — adres bazy.
- `SESSION_SECRET` — losowy ciąg (min. 32 znaki).
- `APP_PASSWORD_HASH` — wynik `npm run haslo "twoje-haslo"`.
- `BLOB_READ_WRITE_TOKEN` — zostaw pusty lokalnie.

Zastosuj schemat i wystartuj:

```bash
npx prisma migrate deploy
```

```bash
npm run dev
```

Aplikacja stoi na http://localhost:3000.

### Skrypty

| Polecenie | Do czego |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | `prisma generate` + `prisma migrate deploy` + build produkcyjny |
| `npm run db:migrate` | nowa migracja po zmianie `prisma/schema.prisma` |
| `npm run db:studio` | podgląd i edycja danych w przeglądarce |
| `npm run haslo "..."` | wygenerowanie nowego `APP_PASSWORD_HASH` |
| `npm run typecheck` | kontrola typów |

### Gdzie lądują pliki

Bez `BLOB_READ_WRITE_TOKEN` zdjęcia i pliki projektów zapisują się w
`public/uploads` (katalog jest w `.gitignore`) — dzięki temu całą aplikację
można przetestować bez konta w chmurze. Gdy token jest ustawiony, ten sam kod
zapisuje do Vercel Blob. Logika siedzi w [`src/lib/storage.ts`](src/lib/storage.ts).

Zdjęcia są zmniejszane w przeglądarce do 2000 px przed wysyłką
([`src/lib/resize-image.ts`](src/lib/resize-image.ts)), więc można wgrywać je
prosto z telefonu i nie zapychać darmowego limitu magazynu.

## Wdrożenie na Vercel

1. Wypchnij repozytorium na GitHub.
2. **Neon** — załóż bazę i skopiuj connection string.
3. **Vercel** — zaimportuj repozytorium (framework wykryje się sam).
4. W ustawieniach projektu na Vercel dodaj zmienne środowiskowe:
   - `DATABASE_URL` — z Neona,
   - `SESSION_SECRET` — **inny niż lokalny**,
   - `APP_PASSWORD_HASH` — z `npm run haslo`,
   - `SHADOW_DATABASE_URL` **pomiń** — jest potrzebny tylko lokalnie.
5. Storage → Blob → utwórz store i połącz z projektem. Vercel sam ustawi
   `BLOB_READ_WRITE_TOKEN`.
6. Deploy. Komenda builda sama zastosuje migracje na bazie Neona.

Po pierwszym wdrożeniu zmień hasło: wygeneruj nowy hash i podmień
`APP_PASSWORD_HASH` w panelu Vercel, potem zrób redeploy.

## Uwagi

- Adresy plików w Vercel Blob są publiczne, choć nieodgadywalne — kto ma link,
  zobaczy zdjęcie bez logowania. Reszta aplikacji jest chroniona hasłem.
- Usunięcie klienta **nie kasuje** jego realizacji — tracą tylko przypisanie.
  Usunięcie realizacji kasuje jej zdjęcia i pliki także z magazynu.
- Pliki wgrane w formularzu, który nigdy nie został zapisany, zostają
  w magazynie jako sieroty. Przy tej skali to pomijalne.
- Kwoty trzymane są w bazie jako liczby całkowite w groszach (`unitPriceGr`),
  żeby uniknąć błędów zaokrągleń przy sumowaniu.
