/** Czytelna nazwa roli do list i profilu. */
export function roleLabel(user: {
  role: "ADMIN" | "EMPLOYEE";
  canManageRealizations: boolean;
  isLaundryManager?: boolean;
  isLaundryDriver?: boolean;
}) {
  if (user.role === "ADMIN") return "Administrator";

  const extras = [
    user.canManageRealizations && "zarządza haftami",
    user.isLaundryManager && "kierownik pralni",
    user.isLaundryDriver && "kierowca",
  ].filter(Boolean);

  return ["Pracownik", ...extras].join(" · ");
}

/** Z których aplikacji osoba może korzystać — do listy pracowników. */
export function appsLabel(user: {
  role: "ADMIN" | "EMPLOYEE";
  canUseEmbroidery: boolean;
  canUseLaundry: boolean;
  canUseTimeclock: boolean;
  canUseAttendance: boolean;
}) {
  if (user.role === "ADMIN") return "wszystkie aplikacje";

  const apps = [
    user.canUseEmbroidery && "hafty",
    user.canUseLaundry && "pralnia",
    user.canUseTimeclock && "rejestrator",
    user.canUseAttendance && "obecność",
  ].filter(Boolean);

  if (apps.length === 4) return "wszystkie aplikacje";
  if (apps.length === 0) return "bez dostępu";

  return apps.join(", ");
}
