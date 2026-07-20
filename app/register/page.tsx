import { redirect } from "next/navigation";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AuthForm from "../login/auth-form";
import { AUTH_LABEL_KEYS } from "../login/labels";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  if (await getSessionOperator()) redirect("/");

  const { invite } = await searchParams;
  const locale = await getLocale();
  const labels = Object.fromEntries(
    AUTH_LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  return (
    <main>
      <section className="auth-box">
      <h1>{t(locale, "register_title")}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "onboarding_intro")}</p>
      <AuthForm mode="register" labels={labels} invite={invite} />
      <p className="demo-hint" style={{ marginTop: 20 }}>
        🔒 {labels.privacy_note_register}{" "}
        <a href="/privacy" className="link">{t(locale, "privacy_title")}</a>
      </p>
      </section>
    </main>
  );
}
