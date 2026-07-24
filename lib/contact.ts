// Central place for support/contact details. These are placeholders for now
// (agreed with the owner) and will be replaced with the real support inbox
// and WhatsApp number later — change them here and every page + the support
// bot updates automatically.
export const CONTACT_EMAIL = "contact@activo.world";

// Display form and the digits-only form used to build a wa.me link.
export const CONTACT_WHATSAPP_DISPLAY = "+995 555 12 34 56";
export const CONTACT_WHATSAPP_DIGITS = "995555123456";

/** Deep link that opens a WhatsApp chat with our number. */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${CONTACT_WHATSAPP_DIGITS}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
