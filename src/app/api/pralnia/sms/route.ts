import { timingSafeEqual } from "node:crypto";

import { normalizePhone } from "@/lib/pralnia/phone";
import { savePickupFromSms } from "@/lib/pralnia/pickups";

export const dynamic = "force-dynamic";

// Przychodzący SMS od klienta („proszę odebrać pranie") przekazany przez bramkę
// SMS (np. SMSAPI.pl — adres callbacku dla SMS-ów przychodzących). Bez logowania
// (proxy.ts przepuszcza tę ścieżkę), ale tylko z tajnym kluczem w adresie:
//   https://<domena>/api/pralnia/sms?token=<SMS_WEBHOOK_TOKEN>
// Bez ustawionej zmiennej SMS_WEBHOOK_TOKEN odbiór SMS-ów jest wyłączony.
//
// Przyjmuje formularz albo JSON. Nadawca: sms_from / from / sender / msisdn,
// treść: sms_text / text / message. Odpowiada „OK", czego oczekuje SMSAPI.

function tokenOk(given: string | null) {
  const secret = process.env.SMS_WEBHOOK_TOKEN?.trim();
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readFields(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = await request.json();
      return Object.fromEntries(Object.entries(body ?? {}).map(([k, v]) => [k, String(v ?? "")]));
    }
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  } catch {
    return {};
  }
}

const pick = (f: Record<string, string>, keys: string[]) => keys.map((k) => f[k]).find((v) => v?.trim()) ?? "";

async function receive(request: Request, fields: Record<string, string>) {
  if (!process.env.SMS_WEBHOOK_TOKEN?.trim()) {
    return new Response("Odbiór SMS wyłączony (brak SMS_WEBHOOK_TOKEN).", { status: 503 });
  }
  if (!tokenOk(new URL(request.url).searchParams.get("token"))) {
    return new Response("Brak dostępu.", { status: 401 });
  }

  const phone = normalizePhone(pick(fields, ["sms_from", "from", "sender", "msisdn", "phone"]));
  if (!phone) return new Response("Brak numeru nadawcy.", { status: 400 });
  const text = pick(fields, ["sms_text", "text", "message", "body"]).trim();

  await savePickupFromSms(phone, text);
  return new Response("OK", { headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  return receive(request, await readFields(request));
}

// Niektóre bramki wysyłają callback jako GET z parametrami w adresie.
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  if (!params.sms_from && !params.from && !params.sender && !params.msisdn) {
    return new Response("Adres odbioru SMS działa. Bramka powinna wysyłać POST.", { status: 200 });
  }
  return receive(request, params);
}
