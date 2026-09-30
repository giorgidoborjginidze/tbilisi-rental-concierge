// The values a legal page's placeholders are filled with: contact details
// (lib/contact.ts — placeholders until launch, see docs/legal-review.md),
// the billing constants the Terms quote, and the documents' date.

import type { Locale } from "@/lib/i18n/strings";
import { CONTACT_EMAIL, LEGAL_ENTITY } from "@/lib/contact";
import { GRACE_DAYS, TRIAL_DAYS } from "@/lib/billing/plans";
import type { LegalValues } from "./doc";

/** When the Terms and the Privacy policy last changed ("YYYY-MM-DD"). */
export const LEGAL_UPDATED = "2026-09-30";

export function legalValues(locale: Locale): LegalValues {
  return {
    email: CONTACT_EMAIL,
    entity: LEGAL_ENTITY[locale],
    trial: TRIAL_DAYS,
    grace: GRACE_DAYS,
    updated: LEGAL_UPDATED,
  };
}

/** The document's language: ?lang= when it names one, else the interface's. */
export function legalLocale(lang: string | undefined, uiLocale: Locale): Locale {
  return lang === "en" || lang === "ka" ? lang : uiLocale;
}
