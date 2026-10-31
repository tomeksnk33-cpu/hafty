import { z } from "zod";

import { parseMoney } from "@/lib/format";

/** Stan zwracany przez akcje formularzy do `useActionState`. */
export type FormState = {
  message?: string;
  errors?: Record<string, string[]>;
  /** Akcja się udała i nie przekierowała — formularz pokazuje potwierdzenie. */
  ok?: boolean;
  /** Zmienia się przy każdym udanym zapisie; formularz używa tego jako `key` do wyczyszczenia pól. */
  savedAt?: number;
} | null;

const text = (max: number) => z.string().trim().max(max, `Maksymalnie ${max} znaków`);

/** Puste pole formularza zapisujemy jako NULL, nie jako pusty tekst. */
const optionalText = (max: number) =>
  text(max).transform((value) => (value === "" ? null : value));

/** Liczba całkowita lub NULL. Akceptuje spacje jako separator tysięcy. */
function optionalInt(label: string, max: number) {
  return z
    .string()
    .overwrite((value) => value.replace(/\s/g, ""))
    .superRefine((value, ctx) => {
      if (value === "") return;

      if (!/^\d+$/.test(value)) {
        ctx.addIssue({ code: "custom", message: `${label}: wpisz liczbę całkowitą` });
        return;
      }

      if (Number(value) > max) {
        ctx.addIssue({ code: "custom", message: `${label}: wartość jest za duża` });
      }
    })
    .transform((value) => (value === "" ? null : Number(value)));
}

export const clientSchema = z.object({
  name: text(200).min(1, "Podaj nazwę klienta"),
  company: optionalText(200),
  phone: optionalText(50),
  email: optionalText(200).refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Niepoprawny adres e-mail",
  ),
  notes: optionalText(5000),
});

export const threadSchema = z.object({
  brand: text(100).min(1, "Podaj producenta, np. Madeira"),
  number: text(50).min(1, "Podaj numer nici"),
  colorName: optionalText(100),
  hex: optionalText(7).refine(
    (value) => value === null || /^#[0-9a-fA-F]{6}$/.test(value),
    "Kolor musi być w formacie #rrggbb",
  ),
});

export const realizationSchema = z.object({
  name: text(200).min(1, "Podaj nazwę realizacji"),

  executedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę wykonania")
    // Doba UTC, żeby data nie przesuwała się o dzień przy zmianie strefy.
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .refine((date) => !Number.isNaN(date.getTime()), "Niepoprawna data"),

  clientId: optionalText(40),
  productType: optionalText(100),
  widthMm: optionalInt("Szerokość", 100_000),
  heightMm: optionalInt("Wysokość", 100_000),
  stitchCount: optionalInt("Liczba ściegów", 100_000_000),

  quantity: z
    .string()
    .overwrite((value) => value.replace(/\s/g, ""))
    .superRefine((value, ctx) => {
      if (!/^\d+$/.test(value) || Number(value) < 1) {
        ctx.addIssue({ code: "custom", message: "Ilość sztuk musi być liczbą co najmniej 1" });
        return;
      }

      if (Number(value) > 1_000_000) {
        ctx.addIssue({ code: "custom", message: "Ilość sztuk jest za duża" });
      }
    })
    .transform(Number),

  unitPriceGr: z
    .string()
    .superRefine((value, ctx) => {
      if (parseMoney(value) === undefined) {
        ctx.addIssue({ code: "custom", message: "Cena musi być kwotą, np. 149,90" });
      }
    })
    .transform((value) => parseMoney(value) ?? null),

  notes: optionalText(5000),

  threadIds: z.array(z.string().min(1)).max(200, "Za dużo nici w jednej realizacji"),
});

const MAX_PASSWORD = 200;

/** Login: małe litery, cyfry, kropka, podkreślenie i myślnik — bez polskich znaków i spacji. */
const loginField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Login musi mieć co najmniej 3 znaki")
  .max(40, "Login może mieć najwyżej 40 znaków")
  .regex(/^[a-z0-9._-]+$/, "Login: tylko litery a–z, cyfry, kropka, myślnik i podkreślenie");

const newPasswordField = z
  .string()
  .min(8, "Hasło musi mieć co najmniej 8 znaków")
  .max(MAX_PASSWORD, `Hasło może mieć najwyżej ${MAX_PASSWORD} znaków`);

const roleField = z.enum(["ADMIN", "EMPLOYEE"], "Wybierz rolę");

export const userCreateSchema = z.object({
  name: text(100).min(1, "Podaj imię i nazwisko"),
  login: loginField,
  password: newPasswordField,
  role: roleField,
  canManageRealizations: z.boolean(),
  canUseEmbroidery: z.boolean(),
  canUseLaundry: z.boolean(),
  canUseTimeclock: z.boolean(),
});

export const userUpdateSchema = z.object({
  name: text(100).min(1, "Podaj imię i nazwisko"),
  login: loginField,
  /** Puste pole = bez zmiany hasła. */
  password: z.string().max(MAX_PASSWORD, `Hasło może mieć najwyżej ${MAX_PASSWORD} znaków`),
  role: roleField,
  canManageRealizations: z.boolean(),
  canUseEmbroidery: z.boolean(),
  canUseLaundry: z.boolean(),
  canUseTimeclock: z.boolean(),
  active: z.boolean(),
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Podaj obecne hasło"),
    next: newPasswordField,
    repeat: z.string(),
  })
  .refine((value) => value.next === value.repeat, {
    path: ["repeat"],
    message: "Hasła nie są takie same",
  });

/** Wpis w dzienniku pracy. `workDate` sprawdzamy dalej w akcji, bo zależy od "dzisiaj" i roli. */
export const workEntrySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę"),
  realizationId: z.string().max(40),
  quantity: z
    .string()
    .overwrite((value) => value.replace(/\s/g, ""))
    .superRefine((value, ctx) => {
      if (!/^\d+$/.test(value) || Number(value) < 1) {
        ctx.addIssue({ code: "custom", message: "Ilość sztuk musi być liczbą co najmniej 1" });
        return;
      }

      if (Number(value) > 100_000) {
        ctx.addIssue({ code: "custom", message: "Ilość sztuk jest za duża" });
      }
    })
    .transform(Number),
  notes: optionalText(1000),
});

/** Znacznik nici na zdjęciu. `photo` to pathname, bo zdjęcie nie ma jeszcze id. */
export const markerSchema = z.object({
  photo: z.string().min(1).max(500),
  thread: z.string().min(1).max(40),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

/** Pole formularza jako tekst — FormData zwraca też File i null. */
export function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Zamienia błędy zod na mapę `pole -> komunikaty` dla formularza. */
export function toFormState(error: z.ZodError): FormState {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (errors[key] ??= []).push(issue.message);
  }

  return { message: "Popraw zaznaczone pola.", errors };
}
