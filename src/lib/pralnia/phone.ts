/**
 * Numer telefonu w jednej postaci (+48…), żeby SMS z „48600100200",
 * „+48 600 100 200" i „600-100-200" trafił do tego samego klienta.
 * Zwraca null, gdy to nie wygląda na numer.
 */
export function normalizePhone(input: string): string | null {
  let d = String(input).trim();
  const plus = d.startsWith("+");
  d = d.replace(/\D/g, "");
  if (!plus && d.startsWith("00")) d = d.slice(2);
  else if (!plus && d.length === 9) d = "48" + d; // polski numer bez kierunkowego
  if (d.length < 8 || d.length > 15) return null;
  return "+" + d;
}

/** +48600100200 -> „+48 600 100 200" (do wyświetlania). */
export function formatPhone(phone: string) {
  const m = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `+48 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
