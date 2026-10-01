// The shape of a legal page (Terms of Service, Privacy policy) and the
// helpers that fill and split its text. Pure and client-safe.
//
// Text may hold placeholders — {email}, {entity}, {trial}, {grace}, {plans},
// {updated} — filled from lib/contact.ts and lib/billing/plans.ts at render
// time (lib/legal/values.ts), and links written as [label](href).

import type { Locale } from "@/lib/i18n/strings";

export interface LegalSection {
  /** Anchor id — the same in every language. */
  id: string;
  heading: string;
  /** Paragraphs, then an optional bulleted list, then paragraphs after it. */
  body?: string[];
  list?: string[];
  after?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalText = Record<Locale, LegalDoc>;

export interface LegalValues {
  email: string;
  entity: string;
  trial: number;
  grace: number;
  /** Every plan with its monthly price ("personal account — Starter 15 ₾, …"). */
  plans: string;
  /** What an account keeps without a paid plan ("2 assets and 1 unit"). */
  free: string;
  updated: string;
}

/** The placeholders a text uses, in order of first use. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))];
}

/** Fills {name} placeholders; an unknown name is left as it is. */
export function fill(text: string, values: LegalValues): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name as keyof LegalValues]) : whole,
  );
}

export type Run = { text: string } | { text: string; href: string };

/** Splits "see [the policy](/privacy)." into text and link runs. */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: match[1], href: match[2] });
    last = at + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Every string of a document, for checks (placeholders, parity). */
export function allText(doc: LegalDoc): string[] {
  return [
    doc.title,
    doc.intro,
    ...doc.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.list ?? []), ...(s.after ?? [])]),
  ];
}
