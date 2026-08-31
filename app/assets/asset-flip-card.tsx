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
    <div className={`aflip${open ? " aflip--open" : ""}`}>
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
