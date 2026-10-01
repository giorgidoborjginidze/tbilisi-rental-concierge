import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { showSplash, SPLASH_COOKIE } from "@/lib/ui/splash";
import SplashIntro from "./splash-intro";
import HeroLogo from "./hero-logo";
import MotionPause from "./motion-pause";
import PortfolioDeck from "./portfolio-deck";
import CountUp from "./count-up";
import { IconCar, IconChat, IconClock, IconPin } from "./icons";

// Public, informational landing for signed-out visitors: what the
// product is, four benefits, the free calculator, one price line.
export default function Landing({ locale }: { locale: Locale }) {
  const iconProps = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const benefits: { t: StringKey; b: StringKey; icon: ReactNode; color: string }[] = [
    {
      t: "land_b1_t",
      b: "land_b1",
      color: "linear-gradient(140deg, #a8daf5, #5ab0e0)",
      // Everything in one place — a dashboard of tiles.
      icon: (
        <svg {...iconProps} aria-hidden>
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
        </svg>
      ),
    },
    {
      t: "land_b2_t",
      b: "land_b2",
      color: "linear-gradient(140deg, #bdf0e0, #6ed3b8)",
      // Automatic sync — two looping arrows.
      icon: (
        <svg {...iconProps} aria-hidden>
          <path d="M21 3v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 21v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      ),
    },
    {
      t: "land_b3_t",
      b: "land_b3",
      color: "linear-gradient(140deg, #f9e5b8, #ecc06a)",
      // Georgia first, then everywhere — a globe.
      icon: (
        <svg {...iconProps} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3Z" />
        </svg>
      ),
    },
    {
      t: "land_b4_t",
      b: "land_b4",
      color: "linear-gradient(140deg, #d3cbf8, #988ae6)",
      // Invest with numbers — a rising trend line.
      icon: (
        <svg {...iconProps} aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      ),
    },
  ];
  return (
    <main>
      <MotionPause />
      <section className="land-hero" data-motion>
        <div className="land-hero__copy">
        <HeroLogo />
        <h1 className="land-hero__title" style={{ fontSize: 32, marginTop: 14 }}>{t(locale, "land_hero")}</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 15 }}>
          {t(locale, "land_sub")}
        </p>
        <div className="land-hero__ctas mt-5 flex flex-wrap items-center gap-3">
          <Link href="/register" className="btn-primary">
            {t(locale, "register_free")}
          </Link>
          <Link href="/invest" className="btn-secondary">
            {t(locale, "land_try_calc")}
          </Link>
        </div>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 12 }}>
          {t(locale, "land_pricing")}
        </p>
        <div
          className="alert-card alert-card--info land-demo"
          style={{ marginTop: 16, maxWidth: 560 }}
        >
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "land_demo")}{" "}
            <code style={{ fontWeight: 600 }}>test@activo.world</code> /{" "}
            <code style={{ fontWeight: 600 }}>test1234</code>
          </div>
          <Link href="/login" className="btn-secondary" style={{ whiteSpace: "nowrap" }}>
            {t(locale, "land_demo_cta")}
          </Link>
        </div>
        </div>
        <PortfolioDeck />
      </section>

      {/* Honest numbers only — what the product actually covers. */}
      <section className="land-stats">
        {(
          [
            { to: 4, label: "land_stat_assets" },
            { to: 5, label: "land_stat_platforms" },
            { to: 30, label: "land_stat_days" },
            { to: 15, label: "land_stat_price" },
          ] as const
        ).map((stat) => (
          <div key={stat.label} className="land-stat">
            <div className="land-stat__n">
              <CountUp to={stat.to} />
            </div>
            <div className="land-stat__l">{t(locale, stat.label)}</div>
          </div>
        ))}
      </section>

      {/* Promo video — shown once NEXT_PUBLIC_DEMO_VIDEO_URL is set to the
          MP4 (self-hosted in /public or an external URL). Poster optional. */}
      {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
        <section style={{ maxWidth: 860, marginTop: 34 }}>
          <h2 style={{ marginTop: 0 }}>{t(locale, "land_video_title")}</h2>
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-card)",
              background: "#000",
            }}
          >
            <video
              controls
              playsInline
              preload="metadata"
              poster={process.env.NEXT_PUBLIC_DEMO_VIDEO_POSTER}
              style={{ width: "100%", display: "block" }}
            >
              <source src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL} type="video/mp4" />
            </video>
          </div>
        </section>
      )}

      <section className="feature-grid" style={{ marginTop: 28 }}>
        {benefits.map((f) => (
          <div key={f.t} className="feature-card">
            <span className="feature-card__icon" style={{ background: f.color }}>
              {f.icon}
            </span>
            <div className="feature-card__title">{t(locale, f.t)}</div>
            <div className="feature-card__body">{t(locale, f.b)}</div>
          </div>
        ))}
      </section>

      {/* A living miniature of the dashboard — decorative, so the page
          shows the product moving instead of describing it. */}
      <section className="land-preview">
        <div>
          <h2 style={{ marginBottom: 4 }}>{t(locale, "land_preview_title")}</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, maxWidth: 460 }}>
            {t(locale, "land_preview_sub")}
          </p>
        </div>
        <div className="pv" aria-hidden data-motion>
          <div className="pv__bar"><span /><span /><span /></div>
          <div className="pv__kpis">
            {[62, 84, 47].map((h, i) => (
              <div key={i} className="pv__kpi">
                <span
                  className="pv__fill"
                  style={{ "--h": `${h}%`, "--d": `${i * 0.6}s` } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
          {/* Drawn by a sliding reveal (two opposite transforms the
              compositor runs), not by animating the stroke — which
              repainted the path on the main thread every frame. */}
          <div className="pv__spark">
            <div className="pv__spark-in">
              <svg viewBox="0 0 220 48">
                <path d="M2 40 C30 38 40 24 62 26 S 100 10 124 16 S 170 30 218 6" fill="none" />
              </svg>
            </div>
          </div>
          <div className="pv__cal">
            {Array.from({ length: 42 }, (_, i) => (
              <span
                key={i}
                className={`pv__cell pv__cell--${(i * 7) % 4}`}
                style={{ "--d": `${(i % 14) * 0.3 + Math.floor(i / 14) * 0.15}s` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </section>

      {/* For a car-rental owner: what the desk shows on the day a driver
          is late — the late row, the red line on the map, and the formal
          WhatsApp message ready to send. A static picture, not live data. */}
      <section className="land-fleet">
        <div>
          <h2 style={{ marginBottom: 4 }}>{t(locale, "land_fleet_title")}</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, maxWidth: 460 }}>
            {t(locale, "land_fleet_sub")}
          </p>
        </div>
        <div className="lf" aria-hidden>
          <div className="lf__row">
            <span className="lf__icon"><IconCar size={18} /></span>
            <span className="lf__main">
              <strong>{t(locale, "land_fleet_car")}</strong>
              <span className="lf__muted">{t(locale, "land_fleet_driver")}</span>
            </span>
            <span className="lf__late"><IconClock size={14} /> {t(locale, "land_fleet_late")}</span>
          </div>
          <div className="lf__row">
            <span className="lf__icon lf__icon--alert"><IconPin size={18} /></span>
            <span className="lf__main">
              <strong>{t(locale, "land_fleet_line")}</strong>
              <span className="lf__muted">{t(locale, "land_fleet_line_sub")}</span>
            </span>
            <svg className="lf__map" viewBox="0 0 64 40" width="64" height="40">
              <circle cx="28" cy="20" r="14" fill="none" strokeDasharray="3 3" />
              <path d="M28 20 C38 18 44 12 56 8" fill="none" />
              <circle cx="56" cy="8" r="3" />
            </svg>
          </div>
          <div className="lf__wa">
            <span className="lf__wa-head"><IconChat size={14} /> WhatsApp</span>
            <p>{t(locale, "land_fleet_msg")}</p>
          </div>
        </div>
      </section>

      {/* Three steps from empty to the full picture. */}
      <section>
        <h2>{t(locale, "land_how_title")}</h2>
        <div className="land-steps">
          {(
            [
              ["land_how_1t", "land_how_1"],
              ["land_how_2t", "land_how_2"],
              ["land_how_3t", "land_how_3"],
            ] as const
          ).map(([titleKey, bodyKey], i) => (
            <div key={titleKey} className="land-step">
              <div className="land-step__n">{i + 1}</div>
              <h3>{t(locale, titleKey)}</h3>
              <p>{t(locale, bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — the same answers the support bot gives. */}
      <section className="land-faq">
        <h2>{t(locale, "land_faq_title")}</h2>
        {(
          [
            ["bot_q_what", "bot_a_what"],
            ["bot_q_pricing", "bot_a_pricing"],
            ["bot_q_sync", "bot_a_sync"],
            ["bot_q_payment", "bot_a_payment"],
            ["bot_q_security", "bot_a_security"],
          ] as const
        ).map(([q, a]) => (
          <details key={q} className="faq">
            <summary>
              {t(locale, q)}
              <svg
                className="faq__plus"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p>{t(locale, a)}</p>
          </details>
        ))}
      </section>

      {/* Closing call to action. */}
      <section className="land-cta">
        <h2>{t(locale, "land_cta_title")}</h2>
        <p>{t(locale, "land_cta_sub")}</p>
        <div className="land-cta__actions">
          <Link href="/register" className="btn-light">
            {t(locale, "register_free")}
          </Link>
          <Link href="/invest" className="btn-ghost">
            {t(locale, "land_try_calc")}
          </Link>
        </div>
      </section>
    </main>
  );
}

/**
 * "/" for a signed-out visitor: the splash on the first look this browser
 * session, then the landing. No loading skeleton may paint before it —
 * there is no app/loading.tsx; the signed-in dashboard has its own
 * (app/dashboard/loading.tsx).
 */
export async function SignedOutHome({ locale }: { locale: Locale }) {
  const splash = showSplash(false, (await cookies()).get(SPLASH_COOKIE)?.value);
  return (
    <>
      {splash && <SplashIntro tapHint={t(locale, "splash_hint")} />}
      <Landing locale={locale} />
    </>
  );
}
