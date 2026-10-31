# Baza haftów

Archiwum wykonanych haftów: realizacje ze zdjęciami, klienci, katalog nici,
wyszukiwarka, podsumowania i dziennik pracy pracowników. Dostęp mają tylko
zalogowane osoby, każda na własnym koncie.

W tej samej aplikacji działa też **Trasa pralni** (`/pralnia`). Po zalogowaniu
pojawia się ekran wyboru: „Baza haftów” albo „Trasa pralni”. Obie części
korzystają z jednej bazy PostgreSQL i tych samych kont pracowników.

## Trasa pralni

Aplikacja w telefonie do zapisywania głosem, co zostało zrobione u klientów na trasie.

1. Pracownik mówi nazwę klienta. Aplikacja odpowiada „OK” albo „Brak klienta”.
2. Mówi asortyment i ilość, np. „prześcieradła 20, ręczniki 15”. Aplikacja powtarza, co zapisała.
3. „Następny klient” przechodzi do kolejnego klienta, „cofnij” usuwa ostatni wpis.
4. „Koniec trasy” wysyła mail z podsumowaniem (każdy klient osobno i suma całej trasy).

- Klienci i asortyment pralni (z „innymi nazwami” do rozpoznawania mowy) oraz
  zakończone trasy są w bazie, w tabelach `LaundryCatalogEntry`, `LaundryRoute`
  i `LaundryRouteEntry`. To osobna lista od klientów haftów. Zmieniać ją może
  każdy zalogowany pracownik.
- Pracownik loguje się swoim kontem; jego imię z konta trafia do maila. Nie ma już PIN-u.
- Bieżąca trasa jest zapisywana w telefonie, więc brak zasięgu (albo wygaśnięcie
  sesji) nic nie psuje: niewysłana trasa czeka i wysyła się sama, gdy wróci
  internet albo po ponownym zalogowaniu.
- Rozpoznawanie mowy działa w Chrome na Androidzie i w Safari na iPhonie. Na
  telefonie otwórz `/pralnia` i wybierz w menu przeglądarki **Dodaj do ekranu głównego**.
- Kod: interfejs w `public/pralnia/` (czysty JS), API w `src/app/api/pralnia/`,
  mail w `src/lib/pralnia/`.

Mail wymaga zmiennych środowiskowych (patrz `.env.example`):

| Zmienna | Co wpisać |
|---|---|
| `MAIL_TO` | `tomasz@gtm-bukowski.pl` (kilka adresów po przecinku) |
| `SMTP_HOST` | serwer poczty wychodzącej, np. z panelu hostingu domeny |
| `SMTP_PORT` | zwykle `465` |
| `SMTP_USER` | login skrzynki, z której idą maile, np. `trasy@gtm-bukowski.pl` |
| `SMTP_PASS` | hasło tej skrzynki |
| `MAIL_FROM` | opcjonalnie nadawca, domyślnie `SMTP_USER` |

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
- **Konta i uprawnienia** — każdy loguje się swoim loginem i hasłem (zob. niżej).
- **Dziennik pracy** — pracownik wpisuje, którego dnia przy której realizacji
  pracował i ile sztuk zrobił. Wpisy może dodawać i poprawiać przez 7 dni
  (liczone razem z dzisiejszym, w czasie warszawskim); starsze zmienia tylko
  administrator.
- **Rozliczenia** (administrator) — tabela „pracownik × dzień" dla wybranego
  miesiąca, a po kliknięciu nazwiska pełna lista wpisów z możliwością poprawiania
  i dodawania wpisów za pracownika.

### Role

| | Pracownik | Pracownik z uprawnieniem do haftów | Administrator |
|---|:---:|:---:|:---:|
| Własny dziennik pracy | ✓ | ✓ | ✓ |
| Przeglądanie realizacji i nici | ✓ | ✓ | ✓ |
| Ceny, wartości, podsumowania | | | ✓ |
| Dodawanie i edycja haftów, klientów, nici | | ✓ | ✓ |
| Rozliczenia, konta pracowników | | | ✓ |

Przy każdym koncie administrator zaznacza też **dostęp do aplikacji**: Baza
haftów, Trasa pralni albo obie. Osoba bez dostępu do haftów (np. kierowca
pralni) po zalogowaniu trafia od razu do trasy pralni i nie wejdzie na żadną
stronę haftów; osoba bez dostępu do pralni nie dostanie danych pralni.
Administrator ma zawsze dostęp do obu.

Uprawnienia sprawdza serwer w każdej stronie, akcji i endpoincie — ukrycie
przycisku w menu to tylko wygoda, nie zabezpieczenie. Osoba z uprawnieniem do
haftów nie widzi pola ceny, a jej edycja haftu **nie nadpisuje** ceny ustawionej
przez administratora. Konta się nie usuwa, tylko wyłącza (wpisy zostają), a
wyłączenie działa od razu — także na już zalogowaną osobę.

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
- `APP_PASSWORD_HASH` — wynik `npm run haslo "twoje-haslo"`. Służy **tylko do
  pierwszego logowania** (patrz niżej); potem hasła są w bazie.
- `ADMIN_LOGIN` — opcjonalnie, login pierwszego administratora (domyślnie `admin`).
- `BLOB_READ_WRITE_TOKEN` — zostaw pusty lokalnie.

Zastosuj schemat i wystartuj:

```bash
npx prisma migrate deploy
```

```bash
npm run dev
```

Aplikacja stoi na http://localhost:3000.

### Pierwsze logowanie i zapomniane hasło administratora

Loginem `admin` (albo `ADMIN_LOGIN`) i hasłem, z którego powstał
`APP_PASSWORD_HASH`, można się zawsze zalogować, dopóki ta zmienna jest ustawiona:

- jeśli konta `admin` nie ma, zostaje założone jako administrator,
- jeśli jest (np. zapomniane hasło), dostaje to hasło, zostaje włączone i ma rolę administratora.

Po zalogowaniu zmień hasło w **Moje konto** (kliknij swoje imię w nagłówku) i
**usuń `APP_PASSWORD_HASH` z ustawień Vercel**, żeby nie zostawiać drugiego
hasła do konta administratora. Pozostałe konta zakładasz w zakładce **Pracownicy**.

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
   - `MAIL_TO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — dla maili
     z trasy pralni (zob. wyżej).
5. Storage → Blob → utwórz store i połącz z projektem. Vercel sam ustawi
   `BLOB_READ_WRITE_TOKEN`.
6. Deploy. Komenda builda sama zastosuje migracje na bazie Neona.

Po wdrożeniu zaloguj się jako `admin` dotychczasowym hasłem, od razu zmień je w
**Moje konto** i załóż konta pracownikom. Zmiana hasła w bazie nie wymaga już
redeployu ani ruszania zmiennych w Vercel.

Migracje dodające konta i dziennik pracy są addytywne (nowe tabele) — nie
zmieniają istniejących danych: realizacji, klientów ani katalogu nici.

## Uwagi

- Adresy plików w Vercel Blob są publiczne, choć nieodgadywalne — kto ma link,
  zobaczy zdjęcie bez logowania. Reszta aplikacji wymaga zalogowania.
- Po zmianie hasła przez administratora albo przez samą osobę **inne jej sesje
  nie wygasają** — działają do wylogowania albo 30 dni. Wyłączenie konta
  natomiast przerywa dostęp natychmiast.
- Po błędnym haśle odpowiedź jest tylko opóźniana o ułamek sekundy; na serverless
  nie ma tu pełnego limitu prób.
- Usunięcie klienta **nie kasuje** jego realizacji — tracą tylko przypisanie.
  Usunięcie realizacji kasuje jej zdjęcia i pliki także z magazynu.
- Pliki wgrane w formularzu, który nigdy nie został zapisany, zostają
  w magazynie jako sieroty. Przy tej skali to pomijalne.
- Kwoty trzymane są w bazie jako liczby całkowite w groszach (`unitPriceGr`),
  żeby uniknąć błędów zaokrągleń przy sumowaniu.
