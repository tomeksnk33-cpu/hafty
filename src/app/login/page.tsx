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
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- statyczny plik z public/, bez optymalizacji */}
          <img src="/brand/logo.png" alt="GTM Bukowski" className="h-16 w-auto max-w-full" />
        </div>

        <div className="card p-6">
          <LoginForm powrot={target} />
        </div>
      </div>
    </main>
  );
}
