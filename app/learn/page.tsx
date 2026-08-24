import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { LESSONS } from "@/lib/learn/lessons";
import StartTourButton from "./start-tour-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn",
  alternates: { canonical: "/learn" },
};

// The learning hub: the interactive tour up top, then one lesson per part
// of the platform — a short silent recording with Georgian captions,
// paired with the same flow written out as numbered steps.
export default async function LearnPage() {
  const locale = await getLocale();
  const operator = await getSessionOperator();
  const lessons = LESSONS[locale] ?? LESSONS.en;

  const has = (rel: string) => existsSync(join(process.cwd(), "public", rel));
  const videoFor = (slug: string) => {
    const rel = `/tutorials/${slug}.mp4`;
    return has(rel) ? rel : null;
  };
  const posterFor = (slug: string) => {
    const rel = `/tutorials/${slug}.jpg`;
    return has(rel) ? rel : undefined;
  };

  return (
    <main style={{ maxWidth: 900 }}>
      <h1>{t(locale, "learn_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: 620 }}>
        {t(locale, "learn_sub")}
      </p>

      <div className="learn-tour card3d" style={{ marginTop: 20 }}>
        <div>
          <div className="card3d__title">{t(locale, "tour_prompt_title")}</div>
          <p className="card3d__body" style={{ maxWidth: 480 }}>
            {t(locale, "tour_prompt_body")}
          </p>
        </div>
        <StartTourButton
          signedIn={operator != null}
          label={t(locale, "learn_start_tour")}
          hint={t(locale, "learn_tour_signin")}
        />
      </div>

      <div className="learn-grid">
        {lessons.map((lesson, i) => {
          const video = videoFor(lesson.slug);
          return (
            <section key={lesson.slug} className="learn-lesson">
              <div className="learn-lesson__head">
                <span className="land-step__n">{i + 1}</span>
                <div>
                  <h2 style={{ margin: 0 }}>{lesson.title}</h2>
                  <p className="learn-lesson__intro">{lesson.intro}</p>
                </div>
              </div>

              {video ? (
                <video
                  className="learn-lesson__video"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  poster={posterFor(lesson.slug)}
                  src={video}
                />
              ) : (
                <div className="learn-lesson__soon">
                  {t(locale, "learn_video_soon")}
                </div>
              )}

              <ol className="learn-lesson__steps">
                {lesson.steps.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </main>
  );
}
