"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export interface FlipAsset {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  typeLabel: string;
  statusLabel: string;
  statusClass: string;
  /** Formatted "2400 GEL · Nino B." or null when vacant. */
  contract: string | null;
  contractUntil: string | null;
  marketRent: string | null;
  belowMarket: boolean;
  value: string | null;
  daily: boolean;
  /** Late-payment warning from the contract's schedule, if any. */
  overdue: { label: string; severe: boolean } | null;
  /** Rentable assets link straight to their service desk. */
  serviceHref: string | null;
  /** Asset family — drives the card's ice tint. */
  category: string;
}

// A turn icon — the only affordance the card needs, since tapping it
// anywhere turns it over. A labelled button would just take up room.
function TurnIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

// Asset card that turns over: the face carries what you scan a list for,
// the back the contract, market rent, listings and door key. Replaces the
// wide table, which needed most of a screen per property on a phone.
export default function AssetFlipCard({
  asset,
  labels,
  extras,
}: {
  asset: FlipAsset;
  labels: Record<string, string>;
  /** Listing links, status buttons and the door key — server-rendered
   *  and slotted onto the back, so the card loses nothing the table had. */
  extras?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  // Anything actionable keeps its own behaviour; only the card's empty
  // space turns it over.
  const onClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a,button,input,select")) return;
    toggle();
  };

  return (
    <div
      className={`aflip${open ? " aflip--open" : ""}`}
      style={{ "--cat": `var(--cat-${asset.category.replace(/_/g, "-")}, var(--cat-other))` } as React.CSSProperties}
    >
      <div
        className="aflip__inner"
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={asset.name}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        {/* ── front ── */}
        <div className="aflip__face">
          {/* Category-tinted header art — where the asset's photo will
              live; until then a silhouette in the category's ice tint. */}
          <div className="aflip__art" aria-hidden>
            <svg viewBox="0 0 340 86" preserveAspectRatio="xMidYMid slice">
              {asset.category === "vehicle" ? (
                <g fill="rgba(255,255,255,.7)">
                  <path d="M60 66h220l-14-22c-4-6-9-9-16-9h-40l-24-16c-4-3-9-5-15-5h-36c-7 0-13 3-17 9l-14 12-13 4c-5 2-5 7-5 10z" />
                  <circle cx="108" cy="68" r="11" fill="rgba(22,53,74,.4)" />
                  <circle cx="232" cy="68" r="11" fill="rgba(22,53,74,.4)" />
                </g>
              ) : (
                <g fill="rgba(255,255,255,.7)">
                  <rect x="58" y="18" width="76" height="68" rx="4" />
                  <rect x="150" y="34" width="92" height="52" rx="4" opacity=".8" />
                  <rect x="258" y="46" width="52" height="40" rx="4" opacity=".6" />
                  {[0, 1, 2].map((r) =>
                    [0, 1].map((c) => (
                      <rect key={`${r}${c}`} x={72 + c * 30} y={27 + r * 20} width="16" height="11" rx="2" fill="rgba(22,53,74,.32)" />
                    )),
                  )}
                </g>
              )}
              <path d="M0 74h340v12H0z" fill="rgba(255,255,255,.3)" />
            </svg>
            <span className="aflip__art-badge">
              {asset.category === "vehicle" ? "🚗" : asset.category === "real_estate" ? "🏠" : "📦"}
            </span>
          </div>
          <div className="aflip__top">
            <div style={{ minWidth: 0 }}>
              <Link href={`/assets/${asset.id}/edit`} className="link aflip__name">
                {asset.name}
              </Link>
              <div className="aflip__sub">
                {asset.district && <div>{asset.district}</div>}
                {asset.address && <div>{asset.address}</div>}
              </div>
            </div>
            <div className="aflip__badges">
              <span className={`badge ${asset.statusClass}`}>{asset.statusLabel}</span>
              {/* Late rent is the one thing worth interrupting a scan for. */}
              {asset.overdue && (
                <span
                  className={`badge ${asset.overdue.severe ? "badge--danger" : "badge--listed"}`}
                >
                  {asset.overdue.label}
                </span>
              )}
            </div>
          </div>

          <div className="aflip__value">{asset.value ?? "—"}</div>
          <div className="aflip__foot">
            <span className="aflip__type">
              {asset.typeLabel}
              {asset.daily && (
                <>
                  {" "}
                  <span className="badge badge--str">{labels.mode_daily}</span>
                </>
              )}
            </span>
            <span className="aflip__turn">
              <TurnIcon />
            </span>
          </div>
        </div>

        {/* ── back ── */}
        <div className="aflip__face aflip__face--back">
          <div className="aflip__row">
            <span>{labels.contracts_col}</span>
            <b>{asset.contract ?? "—"}</b>
          </div>
          {asset.contractUntil && (
            <div className="aflip__row">
              <span>{labels.contract_until}</span>
              <b>{asset.contractUntil}</b>
            </div>
          )}
          {asset.marketRent && (
            <div className="aflip__row">
              <span>{labels.market_rent_est}</span>
              <b>
                {asset.marketRent}
                {asset.belowMarket && (
                  <>
                    {" "}
                    <span className="badge badge--vacant">{labels.below_market}</span>
                  </>
                )}
              </b>
            </div>
          )}
          <div className="aflip__row">
            <span>{labels.asset_value_col}</span>
            <b>{asset.value ?? "—"}</b>
          </div>

          {extras && <div className="aflip__extras">{extras}</div>}

          <div className="aflip__actions">
            <span className="aflip__turn">
              <TurnIcon />
            </span>
            {asset.serviceHref && (
              <Link href={asset.serviceHref} className="btn-chip">
                {labels.rental_service}
              </Link>
            )}
            <Link href={`/assets/${asset.id}/edit`} className="btn-primary aflip__edit">
              {labels.edit}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
