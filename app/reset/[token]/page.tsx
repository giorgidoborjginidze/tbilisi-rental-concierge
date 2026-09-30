import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { plausibleResetToken, resetTokenId, resetUsable } from "@/lib/auth/reset";
import ResetForm from "./reset-form";

export const dynamic = "force-dynamic";
// The URL carries the token: never indexed, never sent on as a Referer.
export const metadata: Metadata = { robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const row = plausibleResetToken(token)
    ? await prisma.passwordReset.findUnique({
        where: { id: resetTokenId(token) },
        select: { expiresAt: true, usedAt: true, operator: { select: { isDemo: true } } },
      })
    : null;
  const usable = resetUsable(row, new Date()) && !row.operator.isDemo;

  const labels = {
    password: t(locale, "password_new"),
    repeat: t(locale, "password_repeat"),
    submit: t(locale, "reset_submit"),
    error_password_short: t(locale, "error_password_short"),
    error_password_mismatch: t(locale, "error_password_mismatch"),
    reset_invalid: t(locale, "reset_invalid"),
    forgot_link: t(locale, "forgot_link"),
  };

  return (
    <main>
      <section className="auth-box">
        <h1>{t(locale, "reset_title")}</h1>
        {usable ? (
          <>
            <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "reset_intro")}</p>
            <ResetForm token={token} labels={labels} />
          </>
        ) : (
          <p className="demo-hint" role="alert">
            {labels.reset_invalid}{" "}
            <Link href="/forgot" className="link">{t(locale, "forgot_title")}</Link>
          </p>
        )}
      </section>
    </main>
  );
}
