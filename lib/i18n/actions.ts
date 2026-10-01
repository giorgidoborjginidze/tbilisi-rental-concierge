"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { LOCALE_COOKIE } from "./locale";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The language switch. For a signed-in owner it is also the account's
 * language — the one the WhatsApp messages to tenants and drivers are
 * written in (lib/rentals/monitor.ts, lib/geo/monitor.ts). The shared demo
 * keeps its own language: a visitor's switch changes only their view.
 */
export async function toggleLocale(formData: FormData) {
  const next = formData.get("locale") === "en" ? "en" : "ka";
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE });
  const operator = await getSessionOperator();
  if (operator && !operator.isDemo) {
    await prisma.operator.update({
      where: { id: operator.userId },
      data: { locale: next, localeSetAt: new Date() },
    });
  }
  revalidatePath("/", "layout");
}
