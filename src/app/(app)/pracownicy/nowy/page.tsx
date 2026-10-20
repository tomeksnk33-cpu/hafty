import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";

import { createUser } from "../actions";
import { emptyUser, UserForm } from "../user-form";

export default async function NewEmployeePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nowy pracownik"
        subtitle="Po zapisaniu pracownik zaloguje się swoim loginem i hasłem."
      />
      <UserForm
        action={createUser}
        defaults={emptyUser}
        mode="create"
        submitLabel="Utwórz konto"
        cancelHref="/pracownicy"
      />
    </div>
  );
}
