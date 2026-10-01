import { describe, expect, it } from "vitest";
import { allText, fill, placeholders, runs, type LegalDoc } from "./doc";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";
import { legalLocale, legalValues, LEGAL_UPDATED, planPrices } from "./values";
import { CONTACT_EMAIL } from "@/lib/contact";
import { GRACE_DAYS, PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { STRING_KEYS, t, type StringKey } from "@/lib/i18n/strings";
import { ATTEMPT_RETENTION_MS } from "@/lib/auth/limit";
import { RESET_TTL_MS } from "@/lib/auth/reset";

const KNOWN = new Set(["email", "entity", "trial", "grace", "plans", "free", "updated"]);
const DOCS: [string, { ka: LegalDoc; en: LegalDoc }][] = [
  ["terms", TERMS],
  ["privacy", PRIVACY],
];

describe("legal documents", () => {
  it.each(DOCS)("%s: Georgian and English have the same sections, lists and placeholders", (_name, doc) => {
    expect(doc.en.sections.map((s) => s.id)).toEqual(doc.ka.sections.map((s) => s.id));
    doc.ka.sections.forEach((ka, i) => {
      const en = doc.en.sections[i];
      expect([en.id, en.body?.length ?? 0, en.list?.length ?? 0, en.after?.length ?? 0]).toEqual([
        ka.id,
        ka.body?.length ?? 0,
        ka.list?.length ?? 0,
        ka.after?.length ?? 0,
      ]);
      const holes = (s: typeof ka) =>
        [...(s.body ?? []), ...(s.list ?? []), ...(s.after ?? [])].flatMap(placeholders).sort();
      expect(holes(en)).toEqual(holes(ka));
      // The same links, in the same order.
      const links = (s: typeof ka) =>
        [...(s.body ?? []), ...(s.list ?? []), ...(s.after ?? [])]
          .flatMap(runs)
          .flatMap((run) => ("href" in run ? [run.href] : []));
      expect(links(en)).toEqual(links(ka));
    });
    expect(allText(doc.en).flatMap((text) => runs(text)).filter((r) => "href" in r).length).toBe(
      allText(doc.ka).flatMap((text) => runs(text)).filter((r) => "href" in r).length,
    );
  });

  it.each(DOCS)("%s: every placeholder is one the page fills, and filling leaves none", (_name, doc) => {
    for (const locale of ["ka", "en"] as const) {
      const values = legalValues(locale);
      for (const text of allText(doc[locale])) {
        for (const name of placeholders(text)) expect(KNOWN.has(name)).toBe(true);
        expect(fill(text, values)).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("names the contact address, the trial and the grace days the product uses", () => {
    const ka = allText(TERMS.ka).map((text) => fill(text, legalValues("ka"))).join("\n");
    expect(ka).toContain(CONTACT_EMAIL);
    expect(ka).toContain(`${TRIAL_DAYS} დღე`);
    expect(ka).toContain(`${GRACE_DAYS} დღის`);
    const privacy = allText(PRIVACY.en).map((text) => fill(text, legalValues("en"))).join("\n");
    expect(privacy).toContain(CONTACT_EMAIL);
    // Third parties that really receive data are named (no "never shared").
    for (const name of ["Meta", "Anthropic", "Flitt", "Vercel", "Neon", "Resend"]) expect(privacy).toContain(name);
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("the Terms quote every plan's price, so a reader needs no account to see them", () => {
    for (const locale of ["ka", "en"] as const) {
      const text = allText(TERMS[locale]).map((line) => fill(line, legalValues(locale))).join("\n");
      for (const plan of PLANS) {
        expect(text).toContain(`${t(locale, `plan_${plan.id}` as StringKey)} ${plan.priceGel} ₾`);
      }
    }
    expect(planPrices("en")).toBe(
      "personal account — Starter 15 ₾, Standard 29 ₾, Pro 49 ₾; company account — Business S 99 ₾, Business M 199 ₾",
    );
    expect(planPrices("ka")).not.toMatch(/plan_/);
  });

  it("no interface text says the data is never shared (the Privacy Policy names who receives it)", () => {
    const enClaim = /\bnever\b[^.]*\bshar(e|ed|ing)\b|\b(do|does|will) not share\b|\bnot shared\b/i;
    const kaClaim = /(არასდროს|არავის|არ)[^.]*(ვუზიარებთ|გავუზიარებთ|გადავცემთ)/;
    const offenders = STRING_KEYS.filter((key) => enClaim.test(t("en", key)) || kaClaim.test(t("ka", key)));
    expect(offenders).toEqual([]);
    for (const doc of [TERMS, PRIVACY]) {
      expect(allText(doc.en).filter((text) => enClaim.test(text))).toEqual([]);
      expect(allText(doc.ka).filter((text) => kaClaim.test(text))).toEqual([]);
    }
    // The support bot's answer still says what is true: never sold.
    expect(t("en", "bot_a_security")).toMatch(/never sell/);
    expect(t("ka", "bot_a_security")).toMatch(/არასდროს ვყიდით/);
  });

  it("the retention periods the Privacy Policy states are the code's", () => {
    const en = allText(PRIVACY.en).join("\n");
    const ka = allText(PRIVACY.ka).join("\n");
    // "A password-reset link works once and for one hour".
    expect(RESET_TTL_MS).toBe(3_600_000);
    expect(en).toMatch(/works once and for one hour/);
    expect(ka).toMatch(/ერთხელ და ერთი საათით/);
    // "deleted after a day" — the daily run (lib/auth/prune.ts) removes what recordAttempt left.
    expect(ATTEMPT_RETENTION_MS).toBe(24 * 3_600_000);
    expect(en).toMatch(/deleted after a day, at the latest within two days/);
    // No bare "24 hours" promise the daily job cannot keep to the hour.
    expect(en).not.toMatch(/24 hours/);
  });

  it("the Terms never say the platform itself calls 112 or the police", () => {
    const en = allText(TERMS.en).join("\n");
    expect(en).toMatch(/never contacts the police or 112 itself/);
    expect(allText(TERMS.ka).join("\n")).toMatch(/თავად არ უკავშირდება პოლიციას ან 112-ს/);
  });
});

describe("legal text helpers", () => {
  it("splits [label](href) links out of a sentence", () => {
    expect(runs("See the [Privacy Policy](/privacy) and [site](https://personaldata.ge).")).toEqual([
      { text: "See the " },
      { text: "Privacy Policy", href: "/privacy" },
      { text: " and " },
      { text: "site", href: "https://personaldata.ge" },
      { text: "." },
    ]);
    expect(runs("plain")).toEqual([{ text: "plain" }]);
  });

  it("fills known placeholders and keeps unknown ones", () => {
    const values = legalValues("en");
    expect(fill("Write to {email} within {grace} days {x}", values)).toBe(
      `Write to ${CONTACT_EMAIL} within ${GRACE_DAYS} days {x}`,
    );
    expect(placeholders("{a} {b} {a}")).toEqual(["a", "b"]);
  });

  it("shows the document in ?lang= when it names a language, else in the interface's", () => {
    expect(legalLocale("en", "ka")).toBe("en");
    expect(legalLocale("ka", "en")).toBe("ka");
    expect(legalLocale(undefined, "ka")).toBe("ka");
    expect(legalLocale("fr", "en")).toBe("en");
  });
});
