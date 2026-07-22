import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import Nav from "./nav";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

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

export const metadata: Metadata = {
  title: "Activo — ქონების დაფა",
  description:
    "მთელი შენი ქონება ერთ დაფაზე — უძრავი ქონება, გაქირავება, შემოსავალი და საინვესტიციო ანალიზი.",
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
          <span>🔒 {t(locale, "appName")}</span>
          <Link href="/privacy" className="link">
            {t(locale, "privacy_title")}
          </Link>
        </footer>
      </body>
    </html>
  );
}
