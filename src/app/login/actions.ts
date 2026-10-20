"use server";

import { redirect } from "next/navigation";

import { authenticate, delayFailedLogin, endSession, startSession } from "@/lib/auth";
import type { FormState } from "@/lib/validation";

export async function logIn(_state: FormState, formData: FormData): Promise<FormState> {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const wanted = String(formData.get("powrot") ?? "");

  if (login.trim() === "" || password === "") {
    return { message: "Podaj login i hasło." };
  }

  const userId = await authenticate(login, password);

  if (!userId) {
    await delayFailedLogin();
    // Jeden komunikat dla złego loginu i złego hasła — nie zdradzamy, które było złe.
    return { message: "Nieprawidłowy login lub hasło." };
  }

  await startSession(userId);

  // Tylko ścieżki wewnętrzne — `powrot` przychodzi z adresu URL.
  const target = wanted.startsWith("/") && !wanted.startsWith("//") ? wanted : "/";

  redirect(target);
}

export async function logOut() {
  await endSession();
  redirect("/login");
}
