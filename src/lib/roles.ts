/** Czytelna nazwa roli do list i profilu. */
export function roleLabel(user: { role: "ADMIN" | "EMPLOYEE"; canManageRealizations: boolean }) {
  if (user.role === "ADMIN") return "Administrator";
  if (user.canManageRealizations) return "Pracownik · zarządza haftami";

  return "Pracownik";
}

/** Z których aplikacji osoba może korzystać — do listy pracowników. */
export function appsLabel(user: {
  role: "ADMIN" | "EMPLOYEE";
  canUseEmbroidery: boolean;
  canUseLaundry: boolean;
  canUseTimeclock: boolean;
}) {
  if (user.role === "ADMIN") return "wszystkie aplikacje";

  const apps = [
    user.canUseEmbroidery && "hafty",
    user.canUseLaundry && "pralnia",
    user.canUseTimeclock && "rejestrator",
  ].filter(Boolean);

  if (apps.length === 3) return "wszystkie aplikacje";
  if (apps.length === 0) return "bez dostępu";

  return apps.join(", ");
}
