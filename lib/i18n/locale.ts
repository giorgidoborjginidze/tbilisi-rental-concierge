import { cookies } from "next/headers";
import type { Locale } from "./strings";

export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "ka" ? "ka" : "en";
}
