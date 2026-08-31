import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { IconTarget, IconLayers, IconGlobe, IconUsers } from "../icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Us",
  alternates: { canonical: "/about" },
};

const SECTIONS: {
  h: StringKey;
  p: StringKey;
  icon: ReactNode;
  color: string;
}[] = [
  { h: "about_h_mission", p: "about_p_mission", icon: <IconTarget />, color: "#2679ad" },
  { h: "about_h_what", p: "about_p_what", icon: <IconLayers />, color: "#23c185" },
  { h: "about_h_georgia", p: "about_p_georgia", icon: <IconGlobe />, color: "#f97316" },
  { h: "about_h_who", p: "about_p_who", icon: <IconUsers />, color: "#3b82f6" },
];

export default async function AboutPage() {
  const locale = await getLocale();

  return (
    <main style={{ maxWidth: 860 }}>
      <h1>{t(locale, "about_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 640, marginBottom: 26 }}>
        {t(locale, "about_intro")}
      </p>

      <div className="deck">
        {SECTIONS.map((section, i) => (
          <div
            key={section.h}
            className="card3d"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="card3d__icon" style={{ background: section.color }}>
              {section.icon}
            </span>
            <div className="card3d__title">{t(locale, section.h)}</div>
            <p className="card3d__body">{t(locale, section.p)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
