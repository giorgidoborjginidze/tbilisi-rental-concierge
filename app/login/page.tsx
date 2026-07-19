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
    <main>
      <section className="auth-box">
      <h1>{t(locale, "login_title")}</h1>
      <AuthForm mode="login" labels={labels} />
      <p className="demo-hint">{t(locale, "demo_hint")}</p>
      </section>
    </main>
  );
}
