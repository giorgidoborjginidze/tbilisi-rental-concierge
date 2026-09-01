"use client";

import Link from "next/link";
import { useState } from "react";

export interface DeckSlide {
  /** "metric" shows a figure; "advice" is the tinted closing card. */
  kind: "metric" | "advice";
  label: string;
  value?: string;
  unit?: string;
  note?: string;
  /** 0–100, drawn as an ice meter under the value. */
  meter?: number;
  tone?: "good" | "warn" | "bad";
}

export interface DeckAsset {
  id: string;
  name: string;
  place: string;
  category: string;
  badge: string;
  slides: DeckSlide[];
}

const TONE: Record<string, { bg: string; ink: string }> = {
  good: { bg: "rgba(143,227,205,.3)", ink: "var(--status-rented-text)" },
  warn: { bg: "rgba(244,211,145,.34)", ink: "var(--status-vacant-text)" },
  bad: { bg: "rgba(245,205,217,.4)", ink: "var(--status-danger-text)" },
};

function Art({ category }: { category: string }) {
  return (
    <svg viewBox="0 0 340 96" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {category === "vehicle" ? (
        <g fill="rgba(255,255,255,.72)">
          <path d="M58 74h224l-15-24c-4-6-9-10-17-10h-41l-25-17c-5-3-10-5-16-5h-37c-7 0-14 3-18 10l-14 13-13 4c-5 2-5 7-5 11z" />
          <circle cx="107" cy="76" r="12" fill="rgba(22,53,74,.4)" />
          <circle cx="235" cy="76" r="12" fill="rgba(22,53,74,.4)" />
        </g>
      ) : (
        <g fill="rgba(255,255,255,.72)">
          <rect x="60" y="20" width="78" height="76" rx="4" />
          <rect x="152" y="38" width="94" height="58" rx="4" opacity=".82" />
          <rect x="260" y="50" width="54" height="46" rx="4" opacity=".62" />
          {[0, 1, 2].map((r) =>
            [0, 1].map((c) => (
              <rect
                key={`${r}${c}`}
                x={74 + c * 32}
                y={30 + r * 22}
                width="17"
                height="12"
                rx="2"
                fill="rgba(22,53,74,.3)"
              />
            )),
          )}
        </g>
      )}
      <path d="M0 84h340v12H0z" fill="rgba(255,255,255,.32)" />
    </svg>
  );
}

// A horizontal deck of the operator's properties: swipe sideways between
// them, tap one to walk its figures — value, rent, status, then the piece
// of advice. Meant to be glanced at before ever opening Assets.
export default function AssetDeckClient({
  assets,
  labels,
}: {
  assets: DeckAsset[];
  labels: { tap: string; restart: string };
}) {
  return (
    <div className="adeck-outer">
      <div className="adeck">
        {assets.map((asset) => (
          <Card key={asset.id} asset={asset} labels={labels} />
        ))}
      </div>
    </div>
  );
}

function Card({
  asset,
  labels,
}: {
  asset: DeckAsset;
  labels: { tap: string; restart: string };
}) {
  const [step, setStep] = useState(0);
  const last = asset.slides.length - 1;
  const advance = () => setStep((n) => (n + 1) % asset.slides.length);

  return (
    <article
      className="adeck__card"
      style={
        {
          "--cat": `var(--cat-${asset.category.replace(/_/g, "-")}, var(--cat-other))`,
        } as React.CSSProperties
      }
      role="button"
      tabIndex={0}
      aria-label={asset.name}
      onClick={(event) => {
        // Links inside keep their own behaviour.
        if ((event.target as HTMLElement).closest("a")) return;
        advance();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          advance();
        }
      }}
    >
      <div className="adeck__art">
        <Art category={asset.category} />
        <span className="adeck__badge">{asset.badge}</span>
      </div>

      <div className="adeck__body">
        <Link href={`/assets/${asset.id}/edit`} className="adeck__name">
          {asset.name}
        </Link>
        <div className="adeck__place">{asset.place}</div>

        <div className="adeck__slides">
          <div
            className="adeck__track"
            style={{ transform: `translateX(-${step * 100}%)` }}
          >
            {asset.slides.map((slide, i) => {
              const tone = slide.tone ? TONE[slide.tone] : null;
              return (
                <div
                  key={i}
                  className={`adeck__slide${slide.kind === "advice" ? " adeck__slide--advice" : " pane"}`}
                  style={
                    slide.kind === "advice" && tone
                      ? { background: tone.bg }
                      : undefined
                  }
                  aria-hidden={i !== step}
                >
                  <span
                    className="adeck__k"
                    style={tone && slide.kind === "advice" ? { color: tone.ink } : undefined}
                  >
                    {slide.label}
                  </span>
                  {slide.value && (
                    <span
                      className="adeck__v"
                      style={slide.tone === "bad" ? { color: "var(--status-danger-text)" } : undefined}
                    >
                      {slide.value}
                      {slide.unit && <small> {slide.unit}</small>}
                    </span>
                  )}
                  {slide.meter != null && (
                    <span className="adeck__meter">
                      <i
                        style={{
                          width: `${Math.min(100, Math.max(0, slide.meter))}%`,
                          background:
                            slide.tone === "bad"
                              ? "linear-gradient(140deg,#f5cdd9,#e08ba4)"
                              : "linear-gradient(140deg,#a8daf5,#5ab0e0)",
                        }}
                      />
                    </span>
                  )}
                  {slide.note && <span className="adeck__note">{slide.note}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="adeck__foot">
          <span className="adeck__dots">
            {asset.slides.map((_, i) => (
              <i key={i} className={i === step ? "on" : undefined} />
            ))}
          </span>
          <span className="adeck__hint">
            {step === last ? labels.restart : labels.tap}
          </span>
        </div>
      </div>
    </article>
  );
}
