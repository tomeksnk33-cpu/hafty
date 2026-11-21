import { OrderForm } from "@/components/order-form";
import { requireClient } from "@/lib/auth";

import { createOwnOrder } from "../actions";
import { TemplateTiles } from "../template-tiles";

export default async function NewOrderPage() {
  const user = await requireClient();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Nowe zlecenie</h1>
      <TemplateTiles clientId={user.clientId} />
      <OrderForm action={createOwnOrder} cancelHref="/moje-zlecenia" />
    </>
  );
}
