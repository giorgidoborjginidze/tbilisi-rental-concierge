// The values a legal page's placeholders are filled with: contact details
// (lib/contact.ts — placeholders until launch, see docs/legal-review.md),
// the billing constants and plan prices the Terms quote (lib/billing/plans.ts,
// so a price change shows in the Terms without editing them), and the
// documents' date.

import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { CONTACT_EMAIL, LEGAL_ENTITY } from "@/lib/contact";
import { GRACE_DAYS, plansFor, TRIAL_DAYS, type AccountType } from "@/lib/billing/plans";
import { formatMoney } from "@/lib/format";
import type { LegalValues } from "./doc";

/** When the Terms and the Privacy policy last changed ("YYYY-MM-DD"). */
export const LEGAL_UPDATED = "2026-09-30";

const ACCOUNT_KINDS: AccountType[] = ["personal", "business"];

const KIND_LABEL: Record<Locale, Record<AccountType, string>> = {
  ka: { personal: "პირადი ანგარიში", business: "კომპანიის ანგარიში" },
  en: { personal: "personal account", business: "company account" },
};

/**
 * Every plan with its monthly price, by account type, as one phrase:
 * "personal account — Starter 15 ₾, Standard 29 ₾, Pro 49 ₾; company
 * account — Business S 99 ₾, Business M 199 ₾". The plan names are the
 * ones the Plans page shows.
 */
export function planPrices(locale: Locale): string {
  return ACCOUNT_KINDS.map((kind) => {
    const plans = plansFor(kind)
      .map((plan) => `${t(locale, `plan_${plan.id}` as StringKey)} ${formatMoney(plan.priceGel, "GEL")}`)
      .join(", ");
    return `${KIND_LABEL[locale][kind]} — ${plans}`;
  }).join("; ");
}

export function legalValues(locale: Locale): LegalValues {
  return {
    email: CONTACT_EMAIL,
    entity: LEGAL_ENTITY[locale],
    trial: TRIAL_DAYS,
    grace: GRACE_DAYS,
    plans: planPrices(locale),
    updated: LEGAL_UPDATED,
  };
}

/** The document's language: ?lang= when it names one, else the interface's. */
export function legalLocale(lang: string | undefined, uiLocale: Locale): Locale {
  return lang === "en" || lang === "ka" ? lang : uiLocale;
}
