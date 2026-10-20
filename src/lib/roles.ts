/** Czytelna nazwa roli do list i profilu. */
export function roleLabel(user: { role: "ADMIN" | "EMPLOYEE"; canManageRealizations: boolean }) {
  if (user.role === "ADMIN") return "Administrator";
  if (user.canManageRealizations) return "Pracownik · zarządza haftami";

  return "Pracownik";
}
