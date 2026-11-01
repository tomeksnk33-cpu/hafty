"use server";

import { requireAdmin } from "@/lib/auth";
import { createTransport, explainMailError, mailConfigured, sendMail, smtpConfig } from "@/lib/mail";

export type MailTestState = {
  ok: boolean;
  message: string;
  hint?: string | null;
  at: number;
} | null;

/** Łączy się z serwerem poczty i wysyła mail testowy do MAIL_TO. */
export async function sendTestMail(): Promise<MailTestState> {
  await requireAdmin();
  const at = Date.now();

  if (!mailConfigured()) {
    return {
      ok: false,
      at,
      message: "Brakuje ustawień poczty.",
      hint: "Uzupełnij w Vercel (Settings → Environment Variables) SMTP_HOST, SMTP_USER i SMTP_PASS, a potem zrób Redeploy.",
    };
  }

  const c = smtpConfig();
  try {
    await createTransport().verify();
  } catch (error) {
    return { ok: false, at, message: errorText(error), hint: explainMailError(error) };
  }

  try {
    await sendMail({
      subject: "Test poczty GTM Bukowski",
      text: `To jest mail testowy z aplikacji GTM Bukowski.\nSerwer: ${c.host}:${c.port} (${c.security})\nNadawca: ${c.from}\n`,
      html: `<p>To jest mail testowy z aplikacji GTM Bukowski.</p><p>Serwer: ${c.host}:${c.port} (${c.security})<br>Nadawca: ${c.from}</p>`,
    });
  } catch (error) {
    return { ok: false, at, message: errorText(error), hint: explainMailError(error) };
  }

  return { ok: true, at, message: `Wysłano mail testowy do ${c.to}. Sprawdź skrzynkę (także folder spam).` };
}

function errorText(error: unknown) {
  const e = error as { code?: string; responseCode?: number; message?: string };
  const code = [e?.code, e?.responseCode].filter(Boolean).join(" ");
  return (code ? `[${code}] ` : "") + (e?.message || String(error));
}
