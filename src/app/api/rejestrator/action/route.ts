import { requireAdmin, requireTimeclockUser } from "@/lib/rejestrator/auth";
import { adminOps, deviceOps } from "@/lib/rejestrator/data";
import { handle, HttpError } from "@/lib/rejestrator/errors";

// Zmiany danych: POST { op, ...parametry }. Czynności kierownika wymagają nagłówka X-Admin-Token;
// odpowiedź zawiera wtedy odświeżony token (tryb kierownika trwa 5 minut od ostatniej czynności).
export function POST(request: Request) {
  return handle(async () => {
    await requireTimeclockUser();
    const { op, ...args } = await request.json().catch(() => ({}));
    if (Object.hasOwn(deviceOps, op)) return Response.json({ ok: true, ...(await deviceOps[op](args)) });
    if (!Object.hasOwn(adminOps, op)) throw new HttpError(400, "Nieznana czynność.");
    const adminToken = await requireAdmin(request);
    return Response.json({ ok: true, adminToken, ...(await adminOps[op](args)) });
  });
}
