import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { smtpConfig } from "@/lib/mail";

import { MailTestForm } from "./test-form";

export const dynamic = "force-dynamic";

const securityLabel: Record<string, string> = {
  ssl: "SSL (zwykle port 465)",
  starttls: "STARTTLS (zwykle port 587)",
  brak: "bez szyfrowania",
};

export default async function MailCheckPage() {
  await requireAdmin();
  const c = smtpConfig();

  const rows: [string, string, string][] = [
    ["SMTP_HOST", "Serwer", c.host || "— brak —"],
    ["SMTP_PORT", "Port", String(c.port)],
    ["SMTP_SECURITY", "Szyfrowanie", securityLabel[c.security] ?? c.security],
    ["SMTP_USER", "Login", c.user || "— brak —"],
    ["SMTP_PASS", "Hasło", c.pass ? `ustawione (${c.pass.length} znaków)` : "— brak —"],
    ["MAIL_FROM", "Nadawca", c.from || "— brak —"],
    ["MAIL_TO", "Odbiorca", c.to],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Sprawdź pocztę" />

      <p className="mb-4 text-sm text-muted">
        Ustawienia, z których korzystają maile trasy pralni, listy obecności i raportu rejestratora. Zmienia się je w
        Vercel (Settings → Environment Variables), a po zmianie trzeba zrobić Redeploy.
      </p>

      <dl className="card mb-6 divide-y divide-line px-4 py-2 text-sm">
        {rows.map(([name, label, value]) => (
          <div key={name} className="flex justify-between gap-4 py-2">
            <dt className="text-muted">
              {label} <span className="font-mono text-xs">{name}</span>
            </dt>
            <dd className="break-all text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="card p-6">
        <MailTestForm />
      </section>
    </div>
  );
}
