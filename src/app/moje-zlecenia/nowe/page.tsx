import { OrderForm } from "@/components/order-form";
import { requireClient } from "@/lib/auth";

import { createOwnOrder } from "../actions";

export default async function NewOrderPage() {
  await requireClient();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Nowe zlecenie</h1>
      <OrderForm action={createOwnOrder} cancelHref="/moje-zlecenia" />
    </>
  );
}
