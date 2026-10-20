import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  // Pełne sprawdzenie konta, nie samego ciasteczka — inaczej osoba z wyłączonym
  // kontem (albo ze starym ciasteczkiem) wpadałaby w pętlę /login ↔ /.
  if (await getCurrentUser()) {
    redirect("/");
  }

  const { powrot } = await props.searchParams;
  const target = typeof powrot === "string" ? powrot : "";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Baza haftów</h1>
          <p className="mt-1 text-sm text-muted">Archiwum realizacji</p>
        </div>

        <div className="card p-6">
          <LoginForm powrot={target} />
        </div>
      </div>
    </main>
  );
}
