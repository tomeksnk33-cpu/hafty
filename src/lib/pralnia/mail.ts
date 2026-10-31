import "server-only";

import nodemailer from "nodemailer";

/** Domyślny odbiorca podsumowań tras, gdy MAIL_TO nie jest ustawione. */
const DEFAULT_MAIL_TO = "tomasz@gtm-bukowski.pl";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail({ subject, text, html }: { subject: string; text: string; html: string }) {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO || DEFAULT_MAIL_TO,
    subject,
    text,
    html,
  });
}
