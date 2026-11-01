import "server-only";

// Poczta jest wspólna dla wszystkich aplikacji (src/lib/mail.ts).
export { mailConfigured, sendMail } from "@/lib/mail";
