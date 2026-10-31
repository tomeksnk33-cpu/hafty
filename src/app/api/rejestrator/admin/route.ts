import { changeAdmin, loginAdmin, requireAdmin, requireTimeclockUser, setupAdmin } from "@/lib/rejestrator/auth";
import { handle, HttpError } from "@/lib/rejestrator/errors";

// Hasło kierownika: POST { action: 'setup' | 'login' | 'change', password }.
export function POST(request: Request) {
  return handle(async () => {
    await requireTimeclockUser();
    const { action, password } = await request.json().catch(() => ({}));
    let adminToken: string;
    if (action === "setup") adminToken = await setupAdmin(password ?? "");
    else if (action === "login") adminToken = await loginAdmin(request, password ?? "");
    else if (action === "change") {
      await requireAdmin(request);
      adminToken = await changeAdmin(password ?? "");
    } else throw new HttpError(400, "Nieznana czynność.");
    return Response.json({ ok: true, adminToken });
  });
}
