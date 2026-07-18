"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "./locale";

export async function toggleLocale(formData: FormData) {
  const next = formData.get("locale") === "ka" ? "ka" : "en";
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
