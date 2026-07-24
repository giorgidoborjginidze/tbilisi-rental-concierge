import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import {
  CONTACT_EMAIL,
  CONTACT_WHATSAPP_DISPLAY,
  whatsappUrl,
} from "@/lib/contact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const locale = await getLocale();

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>✉️ {t(locale, "contact_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20 }}>
        {t(locale, "contact_intro")}
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="alert-card alert-card--underpriced"
          style={{ display: "block", textDecoration: "none" }}
        >
          <h3 className="alert-card__title">📧 {t(locale, "contact_email_label")}</h3>
          <p className="alert-card__detail" style={{ marginTop: 6 }}>{CONTACT_EMAIL}</p>
        </a>

        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="alert-card alert-card--underpriced"
          style={{ display: "block", textDecoration: "none" }}
        >
          <h3 className="alert-card__title">💬 {t(locale, "contact_wa_label")}</h3>
          <p className="alert-card__detail" style={{ marginTop: 6 }}>
            {CONTACT_WHATSAPP_DISPLAY}
          </p>
          <p className="alert-card__detail" style={{ marginTop: 2, opacity: 0.8 }}>
            {t(locale, "contact_wa_note")}
          </p>
        </a>
      </div>

      <p className="hint" style={{ marginTop: 18 }}>{t(locale, "contact_bot_note")}</p>
      <p className="hint" style={{ marginTop: 6, opacity: 0.7 }}>
        {t(locale, "contact_placeholder_note")}
      </p>
    </main>
  );
}
