import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tbilisi Rental Concierge",
  description:
    "Describe your ideal home in plain language — we match, rank, and link you to the real listings.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <Header />
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-4xl px-4 pb-8 pt-4 text-center text-xs text-slate-400">
      We link to original listings; we never republish owners&apos; personal
      data. · ჩვენ ვუკავშირდებით ორიგინალ განცხადებებს.
    </footer>
  );
}
