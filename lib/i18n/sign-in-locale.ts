// Which language wins when an owner signs in — pure, no I/O.
//
// The account's language is also the language of every WhatsApp text its
// tenants and drivers get, so it may change only when the owner means it:
// the language switch while signed in (lib/i18n/actions.ts toggleLocale).
// A device's language cookie can come from anyone — a family member on the
// landing page in English, a shared computer — so at sign-in it is taken
// only when the account never had a language chosen (an old account from
// before languages were saved). Otherwise the device follows the account.

import { asLocale, type Locale } from "./strings";

export interface SignInLocale {
  /** Write this as the account's chosen language (null = leave the account). */
  save: Locale | null;
  /** Set the device's language cookie to this (null = keep the cookie). */
  cookie: Locale | null;
}

export function signInLocale(
  operator: { isDemo: boolean; locale: string; localeSetAt: Date | null },
  device: Locale | null,
): SignInLocale {
  const account = asLocale(operator.locale);
  // The shared demo keeps its own language; a visitor's choice only
  // changes their own view.
  if (operator.isDemo) return { save: null, cookie: device ? null : account };
  // Never chosen: the device's choice becomes the account's.
  if (operator.localeSetAt == null) {
    return device ? { save: device, cookie: null } : { save: null, cookie: account };
  }
  // Chosen before: the device opens in the account's language.
  return { save: null, cookie: device === account ? null : account };
}
