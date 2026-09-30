import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import "./globals.css";
import Nav from "./nav";
import AppMark from "./app-mark";
import SupportBot from "./support-bot";
import TiltProvider from "./tilt-provider";
import TourMount from "./tour-mount";
import TabBar from "./tab-bar";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
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

const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto",
  subsets: ["georgian", "latin"],
});

// Headings only — the serif voice from the Ice design round.
const notoSerifGeorgian = Noto_Serif_Georgian({
  variable: "--font-noto-serif",
  subsets: ["georgian", "latin"],
  weight: ["500", "600", "700"],
});

const SITE_NAME = "Activo";

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
        <footer
          style={{
            borderTop: "1px solid var(--color-border)",
            padding: "16px 32px",
            display: "flex",
            gap: 16,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "var(--color-ink-muted)",
          }}
        >
          <AppMark size={20} />
          <Link href="/privacy" className="link">
            {t(locale, "privacy_title")}
          </Link>
        </footer>
        <SupportBot locale={locale} waUrl={whatsappUrl()} />
        <TourMount />
        <TabBar />
      </body>
    </html>
  );
}
