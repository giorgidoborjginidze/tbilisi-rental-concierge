import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { pageTitle } from "@/lib/i18n/metadata";
import { firstParam, type QueryValue } from "@/lib/params";
import { TERMS } from "@/lib/legal/terms";
import { legalLocale, legalValues } from "@/lib/legal/values";
import LegalDocView from "../legal-doc";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ lang?: QueryValue }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const docLocale = legalLocale(firstParam((await searchParams).lang), await getLocale());
  return { title: pageTitle(TERMS[docLocale].title), alternates: { canonical: "/terms" } };
}

export default async function TermsPage({ searchParams }: Props) {
  const docLocale = legalLocale(firstParam((await searchParams).lang), await getLocale());
  return <LegalDocView doc={TERMS[docLocale]} docLocale={docLocale} values={legalValues(docLocale)} path="/terms" />;
}
