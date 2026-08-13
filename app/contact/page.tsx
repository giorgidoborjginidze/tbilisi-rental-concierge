import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import {
  CONTACT_EMAIL,
  CONTACT_WHATSAPP_DISPLAY,
  whatsappUrl,
} from "@/lib/contact";
import { IconMail, IconChat } from "../icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const locale = await getLocale();

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{t(locale, "contact_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 26 }}>
        {t(locale, "contact_intro")}
      </p>

      <div className="deck">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="card3d"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <span className="card3d__icon" style={{ background: "#4f46e5" }}>
            <IconMail />
          </span>
          <div className="card3d__title">{t(locale, "contact_email_label")}</div>
          <div className="card3d__value">{CONTACT_EMAIL}</div>
        </a>

        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="card3d"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <span className="card3d__icon" style={{ background: "#25d366" }}>
            <IconChat />
          </span>
          <div className="card3d__title">{t(locale, "contact_wa_label")}</div>
          <div className="card3d__value">{CONTACT_WHATSAPP_DISPLAY}</div>
          <p className="card3d__body">{t(locale, "contact_wa_note")}</p>
        </a>
      </div>

      <p className="hint" style={{ marginTop: 20 }}>{t(locale, "contact_bot_note")}</p>
      <p className="hint" style={{ marginTop: 6, opacity: 0.7 }}>
        {t(locale, "contact_placeholder_note")}
      </p>
    </main>
  );
}
