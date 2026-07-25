import { PageHeader } from "@/components/page-header";

import { createRealization } from "../actions";
import { emptyRealization } from "../defaults";
import { loadFormOptions } from "../form-options";
import { RealizationForm } from "../realization-form";

export default async function NewRealizationPage(props: PageProps<"/realizacje/nowa">) {
  const [{ klient }, { clients, productTypes }] = await Promise.all([
    props.searchParams,
    loadFormOptions(),
  ]);

  // Wejście z karty klienta ustawia go z góry.
  const preselected = typeof klient === "string" ? klient : "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nowa realizacja" />
      <RealizationForm
        action={createRealization}
        defaults={emptyRealization(preselected)}
        clients={clients}
        productTypes={productTypes}
        submitLabel="Zapisz realizację"
        cancelHref="/realizacje"
      />
    </div>
  );
}
