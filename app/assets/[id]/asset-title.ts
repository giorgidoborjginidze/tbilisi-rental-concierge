// The browser-tab title of an asset's pages: the page's own name when the
// asset is this workspace's, the "not found" title otherwise — the page
// streams before notFound() runs, so its tab must not claim to edit an
// asset that does not exist.

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { pageTitle } from "@/lib/i18n/metadata";
import { t, type StringKey } from "@/lib/i18n/strings";

export function assetTitled(key: StringKey) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ id: string }>;
  }): Promise<Metadata> {
    const [{ id }, operator, locale] = await Promise.all([params, getSessionOperator(), getLocale()]);
    const asset = operator
      ? await prisma.asset.findFirst({ where: { id, operatorId: operator.id }, select: { id: true } })
      : null;
    return { title: pageTitle(t(locale, asset ? key : "not_found_title")) };
  };
}
