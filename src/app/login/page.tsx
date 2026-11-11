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
      <LoginForm powrot={target} />
    </main>
  );
}
