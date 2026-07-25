import { NextResponse } from "next/server";

import { isLoggedIn } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { checkFile, type UploadKind } from "@/lib/uploads";

/**
 * Przyjmuje pojedynczy plik z formularza realizacji i odkłada go w magazynie.
 * Pliki lecą po jednym, żeby każdy mieścił się w limicie ciała żądania na
 * Vercel (~4,5 MB) niezależnie od tego, ile ich jest w formularzu.
 *
 * Trasa jest chroniona przez proxy.ts, ale sesję sprawdzamy też tutaj —
 * endpoint zapisujący pliki nie powinien polegać wyłącznie na konfiguracji
 * matchera.
 */
export async function POST(request: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Brak pliku." }, { status: 400 });
  }

  if (kind !== "zdjecia" && kind !== "projekty") {
    return NextResponse.json({ error: "Nieznany rodzaj pliku." }, { status: 400 });
  }

  const problem = checkFile(kind as UploadKind, {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  try {
    const stored = await saveFile(kind, file);

    return NextResponse.json({
      url: stored.url,
      pathname: stored.pathname,
      filename: file.name,
      sizeBytes: file.size,
    });
  } catch (error) {
    console.error("Upload nieudany:", error);

    return NextResponse.json(
      { error: "Nie udało się zapisać pliku. Spróbuj ponownie." },
      { status: 500 },
    );
  }
}
