import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import Nav from "./nav";
import ActivoLogo from "./activo-logo";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";

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

const SITE_NAME = "Activo";
const SITE_TITLE = "Activo — შენი აქტივები ერთ ადგილას";
const SITE_DESCRIPTION =
  "მთელი შენი ქონება ერთ დაფაზე — უძრავი ქონება, გაქირავება, ავტოპარკი, შემოსავალი და ციფრული აქტივები (კრიპტო და აქციები).";

export const metadata: Metadata = {
  // Absolute base for every relative URL below → canonical points at the
  // custom domain (or Vercel production URL) rather than any preview host.
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

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
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            🔒 <ActivoLogo height={16} />
          </span>
          <Link href="/privacy" className="link">
            {t(locale, "privacy_title")}
          </Link>
        </footer>
      </body>
    </html>
  );
}
