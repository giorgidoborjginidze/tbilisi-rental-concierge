import { cookies } from "next/headers";
import { asLocale, type Locale } from "./strings";

export { asLocale, DEFAULT_LOCALE } from "./strings";

export const LOCALE_COOKIE = "locale";


export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return asLocale(store.get(LOCALE_COOKIE)?.value);
}

/** The language cookie, when the visitor has one (no default applied). */
export async function chosenLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "en" || value === "ka" ? value : null;
}
