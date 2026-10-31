import { requireTimeclockUser } from "@/lib/rejestrator/auth";
import { checkDay } from "@/lib/rejestrator/data";
import { handle } from "@/lib/rejestrator/errors";
import { sendDueReport, sendReport } from "@/lib/rejestrator/mail";

// Raport mailem: POST { day } wysyła raport z wybranego dnia, POST { auto: true } wysyła dzisiejszy,
// jeśli minęła ustawiona godzina i nikt go jeszcze nie wysłał.
export function POST(request: Request) {
  return handle(async () => {
    await requireTimeclockUser();
    const { day, auto } = await request.json().catch(() => ({}));
    if (auto) return Response.json({ ok: true, ...(await sendDueReport()) });
    return Response.json({ ok: true, sent: true, message: await sendReport(checkDay(day)) });
  });
}
