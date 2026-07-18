"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";

const EXAMPLES: Record<"en" | "ka", string[]> = {
  en: [
    "2-bedroom furnished flat in Vera or Vake, under $800/month, pet-friendly, available from September",
    "Studio in Saburtalo under $500, central heating, available now",
    "3-room apartment in Old Town, max $1200, unfurnished is fine",
  ],
  ka: [
    "ორ საძინებლიანი ავეჯით ბინა ვერაში ან ვაკეში, თვეში $800-მდე, ცხოველებით, სექტემბრიდან",
    "სტუდიო საბურთალოზე $500-მდე, ცენტრალური გათბობით, ახლავე",
    "სამოთახიანი ბინა სოლოლაკში, მაქსიმუმ $1200",
  ],
};

export default function IntakePage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/search-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, query, language: lang }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { id: string };
      router.push(`/search/${data.id}`);
    } catch (err) {
      setError((err as Error).message || t("intake.error"));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("intake.heading")}
        </h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          {t("intake.subheading")}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            {t("intake.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("intake.emailPlaceholder")}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor="query"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            {t("intake.queryLabel")}
          </label>
          <textarea
            id="query"
            required
            minLength={5}
            rows={4}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("intake.queryPlaceholder")}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("intake.submitting") : t("intake.submit")}
        </button>
      </form>

      <div className="mx-auto max-w-2xl">
        <h2 className="mb-2 text-sm font-medium text-slate-500">
          {t("intake.examplesHeading")}
        </h2>
        <div className="flex flex-col gap-2">
          {EXAMPLES[lang].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuery(example)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 transition hover:border-brand-300 hover:bg-brand-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
