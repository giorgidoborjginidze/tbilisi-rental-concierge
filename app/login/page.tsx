import { redirect } from "next/navigation";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AuthForm from "./auth-form";
import { AUTH_LABEL_KEYS } from "./labels";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await getSessionOperator()) redirect("/");

  const locale = await getLocale();
  const labels = Object.fromEntries(
    AUTH_LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );
  // Confirmation that an erasure request was carried out — the account it
  // belonged to no longer exists to be told anywhere else.
  const erased = (await searchParams).erased === "1";

  return (
    <main>
      <section className="auth-box">
      <h1>{t(locale, "login_title")}</h1>
      {erased && (
        <p className="demo-hint" style={{ marginTop: 12 }}>
          {t(locale, "data_erased_notice")}
        </p>
      )}
      <AuthForm mode="login" labels={labels} />
      <p className="demo-hint">{t(locale, "demo_hint")}</p>
      </section>
    </main>
  );
}
