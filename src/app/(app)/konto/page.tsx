import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";

import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Moje konto" />

      <dl className="card mb-6 divide-y divide-line px-4 py-2 text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Imię i nazwisko</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Login</dt>
          <dd className="font-medium">{user.login}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-muted">Uprawnienia</dt>
          <dd className="font-medium">
            {roleLabel({ role: user.role, canManageRealizations: user.canManage })}
          </dd>
        </div>
      </dl>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold">Zmiana hasła</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
