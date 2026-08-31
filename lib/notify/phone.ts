// Phone helpers, kept free of the database so they can be used anywhere
// (server actions, client components, tests).

/** Digits only, international. Georgian local numbers get the 995 prefix. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // 9 digits starting with 5 is a Georgian mobile without its country code.
  if (digits.length === 9 && digits.startsWith("5")) digits = `995${digits}`;
  return digits.length >= 8 ? digits : null;
}

/** Click-to-send WhatsApp link — the fallback that always works. */
export function waLink(phone: string | null, body: string): string {
  const text = encodeURIComponent(body);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
