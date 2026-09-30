import Link from "next/link";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

// A page that does not exist (or a record that is not yours): localized,
// inside the normal layout, with a way back.
export default async function NotFound() {
  const locale = await getLocale();
  return (
    <main>
      <section className="auth-box">
        <h1>{t(locale, "not_found_title")}</h1>
        <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "not_found_body")}</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/" className="btn-primary" style={{ display: "inline-block" }}>
            {t(locale, "not_found_home")}
          </Link>
        </p>
      </section>
    </main>
  );
}
