import { PHOTO_MAX_BYTES } from "@/lib/uploads";

const MAX_SIDE = 2000;
const QUALITY = 0.82;

/**
 * Zmniejsza zdjęcie w przeglądarce przed wysyłką. Zdjęcia z telefonu mają
 * po kilka MB, a do archiwum w zupełności wystarcza 2000 px — dzięki temu
 * mieścimy się w limicie żądania i oszczędzamy darmowy limit magazynu.
 *
 * Gdy przeglądarka nie potrafi zdekodować formatu (zdarza się przy HEIC),
 * zwracamy oryginał — walidacja rozmiaru złapie go dalej i pokaże komunikat.
 */
export async function resizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  // Pliki wektorowe i animowane straciłyby na konwersji do JPEG.
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

    // Małe zdjęcie w rozsądnym formacie nie zyska na ponownej kompresji.
    if (scale === 1 && file.size <= PHOTO_MAX_BYTES / 2) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";

    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
