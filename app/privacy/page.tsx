import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { titled } from "@/lib/i18n/metadata";
import { IconBan, IconEdit, IconLock, IconTrash, IconWall } from "../icons";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("privacy_title", { alternates: { canonical: "/privacy" } });

const SECTIONS: { h: StringKey; p: StringKey; Icon: typeof IconLock }[] = [
  { h: "privacy_h_minimal", p: "privacy_p_minimal", Icon: IconEdit },
  { h: "privacy_h_isolation", p: "privacy_p_isolation", Icon: IconWall },
  { h: "privacy_h_security", p: "privacy_p_security", Icon: IconLock },
  { h: "privacy_h_sharing", p: "privacy_p_sharing", Icon: IconBan },
  { h: "privacy_h_control", p: "privacy_p_control", Icon: IconTrash },
];

export default async function PrivacyPage() {
  const locale = await getLocale();

  return (
    <main style={{ maxWidth: 760 }}>
      <h1 className="icon-text" style={{ gap: 10 }}>
        <span style={{ color: "var(--color-primary)", display: "inline-flex" }}>
          <IconLock size={24} />
        </span>
        {t(locale, "privacy_title")}
      </h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 620, marginBottom: 8 }}>
        {t(locale, "privacy_intro")}
      </p>
      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {SECTIONS.map((section) => (
          <div key={section.h} className="card" style={{ padding: "18px 20px" }}>
            <h3 className="alert-card__title icon-text" style={{ gap: 9 }}>
              <span style={{ color: "var(--color-primary)", display: "inline-flex" }}>
                <section.Icon size={19} />
              </span>
              {t(locale, section.h)}
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
