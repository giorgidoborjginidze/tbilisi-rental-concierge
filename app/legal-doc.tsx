import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/strings";
import { fill, runs, type LegalDoc, type LegalValues } from "@/lib/legal/doc";
import { tbilisiFormat } from "@/lib/time";

// A legal page (Terms of Service, Privacy policy): title, last-updated
// date, a short table of contents and numbered sections. The document's
// language can differ from the interface's (?lang=en on a Georgian UI) —
// the text carries its own lang attribute, and a link opens the other
// language's version.

/** Text with [label](href) links — also used for the short legal notes
 *  on the sign-up and billing pages. */
export function LegalNote({ text }: { text: string }) {
  return (
    <>
      {runs(text).map((run, i) =>
        "href" in run ? (
          run.href.startsWith("/") ? (
            <Link key={i} href={run.href} className="link">
              {run.text}
            </Link>
          ) : (
            <a key={i} href={run.href} className="link" target="_blank" rel="noopener noreferrer">
              {run.text}
            </a>
          )
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

export default function LegalDocView({
  doc,
  docLocale,
  values,
  path,
}: {
  doc: LegalDoc;
  /** The language the document is shown in. */
  docLocale: Locale;
  values: LegalValues;
  /** This page's path, for the other-language link. */
  path: string;
}) {
  const other: Locale = docLocale === "ka" ? "en" : "ka";
  const updated = tbilisiFormat(docLocale, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${values.updated}T12:00:00Z`),
  );
  return (
    <main className="legal">
      <article lang={docLocale}>
        <h1>{doc.title}</h1>
        <p className="legal__meta">
          {t(docLocale, "legal_updated")}: <time dateTime={values.updated}>{updated}</time>
          <span aria-hidden> · </span>
          <Link href={`${path}?lang=${other}`} className="link" hrefLang={other} lang={other}>
            {t(other, "legal_language_version")}
          </Link>
        </p>
        <p className="page-lead">
          <LegalNote text={fill(doc.intro, values)} />
        </p>
        <nav className="card legal__toc" aria-label={t(docLocale, "legal_contents")}>
          <b>{t(docLocale, "legal_contents")}</b>
          <ol>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="link">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <ol className="legal__sections">
          {doc.sections.map((section) => (
            <li key={section.id} id={section.id} className="legal__section">
              <h2>{section.heading}</h2>
              {section.body?.map((p, i) => (
                <p key={`b${i}`}>
                  <LegalNote text={fill(p, values)} />
                </p>
              ))}
              {section.list && (
                <ul>
                  {section.list.map((item, i) => (
                    <li key={i}>
                      <LegalNote text={fill(item, values)} />
                    </li>
                  ))}
                </ul>
              )}
              {section.after?.map((p, i) => (
                <p key={`a${i}`}>
                  <LegalNote text={fill(p, values)} />
                </p>
              ))}
            </li>
          ))}
        </ol>
      </article>
    </main>
  );
}
