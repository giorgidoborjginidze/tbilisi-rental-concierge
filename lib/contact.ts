// Central place for support/contact details. These are placeholders for now
// (agreed with the owner) and will be replaced with the real support inbox
// and WhatsApp number later — change them here and every page + the support
// bot updates automatically. docs/legal-review.md lists every placeholder
// that needs a real value before launch (the Terms and the Privacy policy
// name them).
export const CONTACT_EMAIL = "contact@activo.world";

// Display form and the digits-only form used to build a wa.me link.
export const CONTACT_WHATSAPP_DISPLAY = "+995 555 12 34 56";
export const CONTACT_WHATSAPP_DIGITS = "995555123456";
/**
 * Whether the number above is the real support line. Until it is, nothing
 * links to it (a made-up 555 number may belong to someone): the support
 * bot's "talk to a person" and the contact page offer the email instead.
 */
export const CONTACT_WHATSAPP_READY = false;

/**
 * The legal entity that provides the service — the "controller" of the
 * Privacy policy and the party to the Terms. A placeholder (the brand)
 * until the owner supplies the registered company's name, identification
 * code and legal address (docs/legal-review.md).
 */
export const LEGAL_ENTITY = {
  ka: "Activo (activo.world)",
  en: "Activo (activo.world)",
} as const;

/** Where "talk to a person" goes: WhatsApp once real, else email. */
export function supportUrl(): string {
  return CONTACT_WHATSAPP_READY ? whatsappUrl() : `mailto:${CONTACT_EMAIL}`;
}

/** Deep link that opens a WhatsApp chat with our number. */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${CONTACT_WHATSAPP_DIGITS}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
