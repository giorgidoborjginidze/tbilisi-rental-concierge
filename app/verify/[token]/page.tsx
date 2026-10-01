import Link from "next/link";
import type { Metadata } from "next";
import { confirmEmail } from "@/lib/auth/verify";
import { plausibleResetToken } from "@/lib/auth/reset";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

// The link from the confirmation email: one visit confirms the address.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activo", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const result = plausibleResetToken(token) ? await confirmEmail(token) : "invalid";
  return (
    <main style={{ maxWidth: 520 }}>
      <h1>{t(locale, result === "ok" ? "verify_done_title" : "verify_bad_title")}</h1>
      <p className="page-lead">{t(locale, result === "ok" ? "verify_done_body" : "verify_bad_body")}</p>
      <p>
        <Link href={result === "ok" ? "/" : "/settings"} className="btn-primary">
          {t(locale, result === "ok" ? "verify_done_cta" : "verify_bad_cta")}
        </Link>
      </p>
    </main>
  );
}
