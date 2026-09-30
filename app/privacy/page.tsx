import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { pageTitle } from "@/lib/i18n/metadata";
import { firstParam, type QueryValue } from "@/lib/params";
import { PRIVACY } from "@/lib/legal/privacy";
import { legalLocale, legalValues } from "@/lib/legal/values";
import LegalDocView from "../legal-doc";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ lang?: QueryValue }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const docLocale = legalLocale(firstParam((await searchParams).lang), await getLocale());
  return { title: pageTitle(PRIVACY[docLocale].title), alternates: { canonical: "/privacy" } };
}

export default async function PrivacyPage({ searchParams }: Props) {
  const docLocale = legalLocale(firstParam((await searchParams).lang), await getLocale());
  return <LegalDocView doc={PRIVACY[docLocale]} docLocale={docLocale} values={legalValues(docLocale)} path="/privacy" />;
}
