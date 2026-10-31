/** Podpowiedzi o urządzeniu wysyłane przez telefon (navigator.userAgentData). */
export type DeviceHints = { model?: string; platform?: string; platformVersion?: string };

const clean = (s: string | undefined) => (s ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);

function browserName(ua: string) {
  if (/EdgA?\/|Edg\//.test(ua)) return "Edge";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/FxiOS|Firefox\//.test(ua)) return "Firefox";
  if (/CriOS|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "";
}

function systemName(ua: string, hints: DeviceHints) {
  const hintVersion = clean(hints.platformVersion);
  let m: RegExpMatchArray | null;

  if ((m = ua.match(/(iPhone|iPad|iPod).*? OS (\d+(?:_\d+)*)/))) {
    return { device: m[1], os: `iOS ${m[2].replace(/_/g, ".")}` };
  }
  if ((m = ua.match(/Android ([\d.]+)?;?\s*([^;)]*)/))) {
    const uaModel = (m[2] || "").replace(/\s*Build\/.*$/, "").trim();
    const model = clean(hints.model) || (uaModel && uaModel !== "K" && !/^wv$/i.test(uaModel) ? uaModel : "");
    const version = hintVersion ? hintVersion.split(".")[0] : m[1] || "";
    return { device: model || "Telefon z Androidem", os: version ? `Android ${version}` : "Android" };
  }
  if (/Windows NT/.test(ua)) return { device: "Komputer", os: "Windows" };
  if (/Macintosh/.test(ua)) return { device: "Mac", os: "macOS" };
  if (/CrOS/.test(ua)) return { device: "Chromebook", os: "ChromeOS" };
  if (/Linux/.test(ua)) return { device: "Komputer", os: "Linux" };
  return { device: clean(hints.model) || "Nieznane urządzenie", os: clean(hints.platform) };
}

/** Czytelny opis urządzenia, np. „SM-S918B · Android 14 · Chrome”. */
export function describeDevice(userAgent: string | null, hints: DeviceHints = {}) {
  const ua = userAgent ?? "";
  const { device, os } = systemName(ua, hints);
  return [device, os, browserName(ua)].filter(Boolean).join(" · ").slice(0, 160);
}
