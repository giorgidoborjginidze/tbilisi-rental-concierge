import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

const SECTIONS: { h: StringKey; p: StringKey; icon: string }[] = [
  { h: "privacy_h_minimal", p: "privacy_p_minimal", icon: "✏️" },
  { h: "privacy_h_isolation", p: "privacy_p_isolation", icon: "🧱" },
  { h: "privacy_h_security", p: "privacy_p_security", icon: "🔐" },
  { h: "privacy_h_sharing", p: "privacy_p_sharing", icon: "🚫" },
  { h: "privacy_h_control", p: "privacy_p_control", icon: "🗑️" },
];

export default async function PrivacyPage() {
  const locale = await getLocale();

  return (
    <main style={{ maxWidth: 760 }}>
      <h1>🔒 {t(locale, "privacy_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 620, marginBottom: 8 }}>
        {t(locale, "privacy_intro")}
      </p>
      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {SECTIONS.map((section) => (
          <div
            key={section.h}
            className="alert-card alert-card--underpriced"
            style={{ display: "block" }}
          >
            <h3 className="alert-card__title">
              {section.icon} {t(locale, section.h)}
            </h3>
            <p className="alert-card__detail" style={{ marginTop: 6 }}>
              {t(locale, section.p)}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
