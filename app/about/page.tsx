import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Us",
  alternates: { canonical: "/about" },
};

const SECTIONS: { h: StringKey; p: StringKey; icon: string }[] = [
  { h: "about_h_mission", p: "about_p_mission", icon: "🎯" },
  { h: "about_h_what", p: "about_p_what", icon: "🧭" },
  { h: "about_h_georgia", p: "about_p_georgia", icon: "🇬🇪" },
  { h: "about_h_who", p: "about_p_who", icon: "👥" },
];

export default async function AboutPage() {
  const locale = await getLocale();

  return (
    <main style={{ maxWidth: 760 }}>
      <h1>ℹ️ {t(locale, "about_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 640, marginBottom: 8 }}>
        {t(locale, "about_intro")}
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
