"use server";

import { delayFailedLogin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { fieldValue, passwordChangeSchema, toFormState, type FormState } from "@/lib/validation";

export async function changeOwnPassword(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = passwordChangeSchema.safeParse({
    current: fieldValue(formData, "current"),
    next: fieldValue(formData, "next"),
    repeat: fieldValue(formData, "repeat"),
  });

  if (!parsed.success) {
    return toFormState(parsed.error);
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!account || !verifyPassword(parsed.data.current, account.passwordHash)) {
    // Obecne hasło pytamy po to, by przejęta sesja nie wystarczyła do przejęcia konta
    // — więc zgadywanie go też spowalniamy, jak przy logowaniu.
    await delayFailedLogin();

    return {
      message: "Obecne hasło jest nieprawidłowe.",
      errors: { current: ["Nieprawidłowe hasło"] },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.next) },
  });

  return { ok: true, message: "Hasło zostało zmienione.", savedAt: Date.now() };
}
