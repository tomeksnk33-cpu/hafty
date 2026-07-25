import type { QuickThread } from "@/app/(app)/nici/actions";
import { todayInputValue } from "@/lib/format";
import type { MarkerInput } from "@/lib/markers";
import type { UploadedFile } from "@/lib/uploads";

// Osobny moduł, bo `realization-form.tsx` jest komponentem klienckim —
// funkcji z pliku "use client" nie da się wywołać na serwerze.

export type RealizationDefaults = {
  name: string;
  executedAt: string;
  clientId: string;
  productType: string;
  widthMm: string;
  heightMm: string;
  stitchCount: string;
  quantity: string;
  unitPriceGr: string;
  notes: string;
  threads: QuickThread[];
  photos: UploadedFile[];
  designFiles: UploadedFile[];
  markers: MarkerInput[];
};

export function emptyRealization(clientId = ""): RealizationDefaults {
  return {
    name: "",
    executedAt: todayInputValue(),
    clientId,
    productType: "",
    widthMm: "",
    heightMm: "",
    stitchCount: "",
    quantity: "1",
    unitPriceGr: "",
    notes: "",
    threads: [],
    photos: [],
    designFiles: [],
    markers: [],
  };
}
