import "server-only";

import nodemailer from "nodemailer";

/** Domyślny odbiorca maili, gdy MAIL_TO nie jest ustawione. */
export const DEFAULT_MAIL_TO = "tomasz@gtm-bukowski.pl";

// Wartości wklejane w Vercel często mają cudzysłowy albo spacje na końcu.
const env = (name: string) => (process.env[name] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

/** Ustawienia SMTP ze zmiennych środowiskowych, wspólne dla wszystkich aplikacji. */
export function smtpConfig() {
  const port = Number(env("SMTP_PORT") || 465);
  const security = (env("SMTP_SECURITY") || (port === 465 ? "ssl" : "starttls")).toLowerCase();
  const user = env("SMTP_USER");

  return {
    host: env("SMTP_HOST"),
    port,
    security: security === "ssl" || security === "brak" ? security : "starttls",
    user,
    // Google pokazuje hasło do aplikacji w grupach ze spacjami; spacje nie są jego częścią.
    pass: /gmail|google/i.test(env("SMTP_HOST")) ? env("SMTP_PASS").replace(/\s+/g, "") : env("SMTP_PASS"),
    from: env("MAIL_FROM") || user,
    to: env("MAIL_TO") || DEFAULT_MAIL_TO,
  };
}

export function mailConfigured() {
  const c = smtpConfig();
  return Boolean(c.host && c.user && c.pass);
}

export function createTransport() {
  const c = smtpConfig();
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.security === "ssl",
    requireTLS: c.security === "starttls",
    ignoreTLS: c.security === "brak",
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    // Krócej niż limit czasu funkcji na Vercelu, żeby zamiast zawieszenia był czytelny błąd.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

/** Wysyła mail do MAIL_TO (albo podanych odbiorców). */
export async function sendMail({
  subject,
  text,
  html,
  to,
}: {
  subject: string;
  text: string;
  html: string;
  to?: string;
}) {
  const c = smtpConfig();
  await createTransport().sendMail({ from: c.from, to: to || c.to, subject, text, html });
}

/** Błąd serwera poczty przetłumaczony na wskazówkę, co poprawić w ustawieniach. */
export function explainMailError(error: unknown) {
  const e = (error ?? {}) as { code?: string; responseCode?: number; message?: string; command?: string };
  const message = e.message || String(error);
  const c = smtpConfig();

  if (e.code === "EAUTH" || e.responseCode === 535 || e.responseCode === 534) {
    if (/gmail|google/i.test(c.host)) {
      return "Gmail odrzucił login lub hasło. Gmail wymaga hasła do aplikacji (myaccount.google.com/apppasswords, przy włączonej weryfikacji dwuetapowej), a nie zwykłego hasła do konta. SMTP_USER to pełny adres Gmail.";
    }
    return "Serwer poczty odrzucił login lub hasło. Sprawdź SMTP_USER (zwykle pełny adres e-mail) i SMTP_PASS.";
  }
  if (/wrong version number|ssl3_get_record|tls_validate_record_header/i.test(message)) {
    return c.security === "ssl"
      ? "Ten port nie używa SSL. Dla portu 587 ustaw SMTP_PORT=587 (wtedy STARTTLS) albo SMTP_SECURITY=starttls."
      : "Ten port wymaga SSL. Ustaw SMTP_PORT=465 albo SMTP_SECURITY=ssl.";
  }
  if (e.code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(message)) {
    return `Nie ma takiego serwera „${c.host}”. Sprawdź SMTP_HOST (adres serwera SMTP od dostawcy poczty).`;
  }
  if (e.code === "ETIMEDOUT" || /timeout|ETIMEDOUT/i.test(message)) {
    return `Serwer ${c.host}:${c.port} nie odpowiada. Sprawdź SMTP_HOST i SMTP_PORT (zwykle 465 albo 587). Port 25 jest zwykle zablokowany.`;
  }
  if (e.code === "ECONNECTION" || /ECONNREFUSED|ECONNRESET/.test(message)) {
    return `Nie można połączyć się z ${c.host}:${c.port}. Sprawdź SMTP_HOST, SMTP_PORT i SMTP_SECURITY.`;
  }
  if (e.code === "EENVELOPE" || e.responseCode === 553 || e.responseCode === 550 || e.responseCode === 554) {
    return `Serwer nie przyjął nadawcy lub odbiorcy. Nadawca (MAIL_FROM, teraz „${c.from}”) zwykle musi być tą samą skrzynką co SMTP_USER. Odbiorca: „${c.to}”.`;
  }
  if (/self[- ]signed|certificate/i.test(message)) {
    return "Problem z certyfikatem serwera poczty. Użyj nazwy serwera podanej przez dostawcę (nie adresu IP).";
  }
  return null;
}

/** „Nie udało się wysłać maila: …” z podpowiedzią, gdy wiadomo, co poprawić. */
export function mailErrorText(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const hint = explainMailError(error);
  return "Nie udało się wysłać maila: " + (hint ? `${hint} (${raw})` : raw);
}
