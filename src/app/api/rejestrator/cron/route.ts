import { handle, HttpError } from "@/lib/rejestrator/errors";
import { sendDueReport } from "@/lib/rejestrator/mail";

// Wywoływane codziennie przez Vercel Cron (vercel.json): wysyła raport, jeśli żadne urządzenie
// nie zrobiło tego wcześniej. Trasa nie wymaga logowania (proxy.ts ją przepuszcza); jeśli
// ustawiono CRON_SECRET, Vercel dołącza go w nagłówku. Wywołanie przez kogoś obcego może
// najwyżej wysłać dzisiejszy raport — i to tylko raz, po ustawionej godzinie.
export function GET(request: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new HttpError(401, "Brak dostępu.");
    }
    return Response.json({ ok: true, ...(await sendDueReport()) });
  });
}
