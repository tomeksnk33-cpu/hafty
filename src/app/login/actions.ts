"use server";

import { redirect } from "next/navigation";

import { delayFailedLogin, endSession, isPasswordCorrect, startSession } from "@/lib/auth";
import type { FormState } from "@/lib/validation";

export async function logIn(_state: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const wanted = String(formData.get("powrot") ?? "");

  if (password === "") {
    return { message: "Podaj hasło." };
  }

  if (!isPasswordCorrect(password)) {
    await delayFailedLogin();
    return { message: "Nieprawidłowe hasło." };
  }

  await startSession();

  // Tylko ścieżki wewnętrzne — `powrot` przychodzi z adresu URL.
  const target = wanted.startsWith("/") && !wanted.startsWith("//") ? wanted : "/";

  redirect(target);
}

export async function logOut() {
  await endSession();
  redirect("/login");
}
