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
}) {
  if (user.role === "ADMIN" || (user.canUseEmbroidery && user.canUseLaundry)) {
    return "hafty i pralnia";
  }
  if (user.canUseEmbroidery) return "tylko hafty";
  if (user.canUseLaundry) return "tylko pralnia";

  return "bez dostępu";
}
