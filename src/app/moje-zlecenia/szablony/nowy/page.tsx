import Link from "next/link";

import { OrderForm } from "@/components/order-form";
import { requireClient } from "@/lib/auth";

import { createOwnTemplate } from "../actions";

export default async function NewOwnTemplatePage() {
  await requireClient();

  return (
    <>
      <Link href="/moje-zlecenia/szablony" className="text-sm text-muted hover:text-ink">
        ← Moje szablony
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Nowy szablon</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Przy zamówieniu z tego szablonu podasz tylko ilość.</p>
      <OrderForm
        template
        action={createOwnTemplate}
        cancelHref="/moje-zlecenia/szablony"
        submitLabel="Zapisz szablon"
      />
    </>
  );
}
