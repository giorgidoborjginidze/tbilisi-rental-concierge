import { redirect } from "next/navigation";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AuthForm from "./auth-form";
import { AUTH_LABEL_KEYS } from "./labels";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionOperator()) redirect("/");

  const locale = await getLocale();
  const labels = Object.fromEntries(
    AUTH_LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold">{t(locale, "login_title")}</h1>
      <AuthForm mode="login" labels={labels} />
      <p className="mt-6 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        {t(locale, "demo_hint")}
      </p>
    </main>
  );
}
