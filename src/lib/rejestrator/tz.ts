// Dni i godziny rejestratora (wspólny moduł core.js) liczone są w czasie lokalnym
// procesu, więc ustawiamy czas polski. Reszta aplikacji podaje strefę jawnie
// (zob. lib/format.ts), więc to ustawienie jej nie zmienia. Zmiennej TZ nie da
// się ustawić w panelu Vercel (jest zarezerwowana).
process.env.TZ = "Europe/Warsaw";

export {};
