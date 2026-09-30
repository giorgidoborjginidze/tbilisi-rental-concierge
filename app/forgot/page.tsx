import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { emailConfigured } from "@/lib/email";
import { CONTACT_EMAIL } from "@/lib/contact";
import ForgotForm from "./forgot-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// "Forgot password": sends a one-hour, single-use link by email. Until the
// email service is set up (RESEND_API_KEY + EMAIL_FROM), it says so and
// points to support instead of pretending to send anything.
export default async function ForgotPage() {
  const locale = await getLocale();
  const unavailable = t(locale, "forgot_unavailable").replace("{email}", CONTACT_EMAIL);
  const labels = {
    email: t(locale, "operator_email"),
    submit: t(locale, "forgot_submit"),
    sent: t(locale, "forgot_sent"),
    error_email_invalid: t(locale, "error_email_invalid"),
    error_too_many_resets: t(locale, "error_too_many_resets"),
    forgot_unavailable: unavailable,
  };

  return (
    <main>
      <section className="auth-box">
        <h1>{t(locale, "forgot_title")}</h1>
        {emailConfigured() ? (
          <>
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "forgot_intro")}</p>
            <ForgotForm labels={labels} />
          </>
        ) : (
          <p className="demo-hint" role="note">
            {unavailable.split(CONTACT_EMAIL)[0]}
            <a href={`mailto:${CONTACT_EMAIL}`} className="link">{CONTACT_EMAIL}</a>
            {unavailable.split(CONTACT_EMAIL).slice(1).join(CONTACT_EMAIL)}
          </p>
        )}
        <p style={{ fontSize: 13, marginTop: 18 }}>
          <Link href="/login" className="link">{t(locale, "forgot_back")}</Link>
        </p>
      </section>
    </main>
  );
}
