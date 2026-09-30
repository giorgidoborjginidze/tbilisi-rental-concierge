import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import "./globals.css";
import Nav from "./nav";
import AppMark from "./app-mark";
import SupportBot, { type BotLabels } from "./support-bot";
import TiltProvider from "./tilt-provider";
import TourMount from "./tour-mount";
import TabBar from "./tab-bar";
import { getLocale } from "@/lib/i18n/locale";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { BOT_FAQ_IDS } from "@/lib/nav/support";
import { siteUrl } from "@/lib/site";
import { whatsappUrl } from "@/lib/contact";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// latin-ext carries the lari sign (₾, U+20BE). Without it the browser finds
// ₾ on the page only while laying it out, fetches that file late and lays
// the whole page out again when it lands; listed here, it is preloaded with
// the rest and arrives before first paint.
const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto",
  subsets: ["georgian", "latin", "latin-ext"],
});

// Headings only — the serif voice from the Ice design round.
const notoSerifGeorgian = Noto_Serif_Georgian({
  variable: "--font-noto-serif",
  subsets: ["georgian", "latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const SITE_NAME = "Activo";

// The page may draw under the phone's home indicator (the tab bar and the
// footer keep clear of it with env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** The support bot's words — only these, not the whole dictionary. */
function botLabels(locale: Locale): BotLabels {
  const tr = (key: StringKey) => t(locale, key);
  return {
    launcher: tr("bot_launcher"),
    title: tr("bot_title"),
    subtitle: tr("bot_subtitle"),
    greeting: tr("bot_greeting"),
    placeholder: tr("bot_placeholder"),
    send: tr("bot_send"),
    noAnswer: tr("bot_no_answer"),
    operatorIntro: tr("bot_operator_intro"),
    operatorCta: tr("bot_operator_cta"),
    close: tr("bot_close"),
    askHuman: tr("bot_q_human"),
    faq: Object.fromEntries(
      BOT_FAQ_IDS.map((id) => [
        id,
        { q: tr(`bot_q_${id}` as StringKey), a: tr(`bot_a_${id}` as StringKey) },
      ]),
    ),
  };
}

// Georgian unless the visitor switched to English (crawlers carry no
// cookie, so search engines index the Georgian site). Every page sets its
// own title; this is the home page's and the template around the others.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const title = t(locale, "site_title");
  const description = t(locale, "site_description");
  return {
    // Absolute base for every relative URL below → canonical points at the
    // custom domain (or Vercel production URL) rather than any preview host.
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${SITE_NAME}` },
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: "/",
      locale: locale === "ka" ? "ka_GE" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  // Manual theme choice ("light" | "dark"); absent = follow the OS.
  const themeCookie = (await cookies()).get("theme")?.value;
  const theme =
    themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} ${notoSerifGeorgian.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TiltProvider />
        <Nav />
        <div className="flex-1">{children}</div>
        {/* On a phone with the tab bar, the footer keeps clear of it
            (globals.css .site-footer) so the privacy link can be tapped. */}
        <footer className="site-footer">
          <AppMark size={20} />
          <Link href="/privacy" className="link">
            {t(locale, "privacy_title")}
          </Link>
        </footer>
        <SupportBot labels={botLabels(locale)} waUrl={whatsappUrl()} />
        <TourMount />
        <TabBar />
      </body>
    </html>
  );
}
