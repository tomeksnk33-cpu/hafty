import "server-only";

import { prisma } from "@/lib/db";

export type LaundrySettingsOut = { hideVoice: boolean; hideRouteDate: boolean };

/** Ustawienia pralni (wiersz id = 1); bez zapisanego wiersza — wszystko widoczne. */
export async function laundrySettings(): Promise<LaundrySettingsOut> {
  const row = await prisma.laundrySettings.findUnique({
    where: { id: 1 },
    select: { hideVoice: true, hideRouteDate: true },
  });
  return row ?? { hideVoice: false, hideRouteDate: false };
}
