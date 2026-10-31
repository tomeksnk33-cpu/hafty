import { adminIsSet, requireTimeclockUser } from "@/lib/rejestrator/auth";
import { checkDay, getData, getVersions } from "@/lib/rejestrator/data";
import { handle } from "@/lib/rejestrator/errors";
import { mailStatus } from "@/lib/rejestrator/mail";

// Odczyt danych. ?versions=1 zwraca tylko numery wersji (urządzenia sprawdzają je co kilka sekund),
// ?get=people,tasks,settings,last&days=2026-10-20,… zwraca dane.
export function GET(request: Request) {
  return handle(async () => {
    await requireTimeclockUser();
    const q = new URL(request.url).searchParams;
    const days = (q.get("days") || "").split(",").filter(Boolean).slice(0, 62).map(checkDay);
    if (q.get("versions")) return Response.json({ ok: true, ...(await getVersions(days)) });
    const what = (q.get("get") || "").split(",");
    const out: Record<string, unknown> = await getData(what, days);
    if (what.includes("settings")) {
      out.mail = await mailStatus();
      out.adminSet = await adminIsSet();
    }
    return Response.json({ ok: true, ...out });
  });
}
