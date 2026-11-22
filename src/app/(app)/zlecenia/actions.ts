"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEmbroideryUser, requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORDER_STATUSES, type OrderStatusValue } from "@/lib/orders";
import { orderFiles, removeUnusedOrderFiles } from "@/lib/orders-server";

function refresh(id: string) {
  revalidatePath("/zlecenia");
  revalidatePath(`/zlecenia/${id}`);
  revalidatePath("/moje-zlecenia");
  revalidatePath(`/moje-zlecenia/${id}`);
}

/** Zmiana etapu zlecenia — każdy pracownik bazy haftów. */
export async function setOrderStatus(id: string, status: OrderStatusValue) {
  await requireEmbroideryUser();

  if (!ORDER_STATUSES.includes(status)) return;

  await prisma.embroideryOrder.updateMany({ where: { id }, data: { status } });

  refresh(id);
}

/** Usuwa zlecenie razem ze zdjęciami — tylko osoba zarządzająca haftami. */
export async function deleteOrder(id: string) {
  await requireManager();

  const photos = await orderFiles({ id });

  await prisma.embroideryOrder.deleteMany({ where: { id } });
  await removeUnusedOrderFiles(photos);

  refresh(id);
  redirect("/zlecenia");
}
