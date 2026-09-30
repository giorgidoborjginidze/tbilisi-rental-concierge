// Per-route <title>s in the reader's language. The root layout's template
// turns "Assets" into "Assets · Activo" (ქართულად: "აქტივები · Activo"), so
// tabs, history and bookmarks tell pages apart and a screen reader
// announces where the owner landed.

import type { Metadata } from "next";
import { getLocale } from "./locale";
import { t, type StringKey } from "./strings";

const SITE_NAME = "Activo";

/** "Assets" → "Assets · Activo"; a title that already names Activo stays as it is. */
export function pageTitle(text: string): Metadata["title"] {
  return { absolute: text.includes(SITE_NAME) ? text : `${text} · ${SITE_NAME}` };
}

/** A page's `generateMetadata`: its title from the dictionary. */
export function titled(key: StringKey, extra: Metadata = {}) {
  return async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    return { title: pageTitle(t(locale, key)), ...extra };
  };
}
