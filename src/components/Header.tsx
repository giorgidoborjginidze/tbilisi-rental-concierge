"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

export function Header() {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          {t("app.title")}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-brand-700"
          >
            {t("nav.newSearch")}
          </Link>
          <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={
                lang === "en"
                  ? "bg-brand-600 px-2.5 py-1 font-medium text-white"
                  : "bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100"
              }
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("ka")}
              className={
                lang === "ka"
                  ? "bg-brand-600 px-2.5 py-1 font-medium text-white"
                  : "bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100"
              }
            >
              ქართ
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
