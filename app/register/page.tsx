import { redirect } from "next/navigation";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AuthForm from "../login/auth-form";
import { AUTH_LABEL_KEYS } from "../login/labels";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSessionOperator()) redirect("/");

  const locale = await getLocale();
  const labels = Object.fromEntries(
    AUTH_LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold">{t(locale, "register_title")}</h1>
      <p className="mt-2 text-neutral-500">{t(locale, "onboarding_intro")}</p>
      <AuthForm mode="register" labels={labels} />
    </main>
  );
}
