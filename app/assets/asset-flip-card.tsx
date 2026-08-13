"use client";

import Link from "next/link";
import { useState } from "react";

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
}

// Mobile-only asset card. The front carries what you scan a list for —
// name, status, value — and the details live on the back, so the card
// stays one screenful instead of a column of labels. The table is still
// rendered for wider screens, where there is room to show everything.
export default function AssetFlipCard({
  asset,
  labels,
}: {
  asset: FlipAsset;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`aflip${open ? " aflip--open" : ""}`}>
      <div className="aflip__inner">
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
            <span className={`badge ${asset.statusClass}`}>{asset.statusLabel}</span>
          </div>

          <div className="aflip__value">{asset.value ?? "—"}</div>
          <div className="aflip__type">
            {asset.typeLabel}
            {asset.daily && (
              <>
                {" "}
                <span className="badge badge--str">{labels.mode_daily}</span>
              </>
            )}
          </div>

          <button type="button" className="aflip__btn" onClick={() => setOpen(true)}>
            {labels.details} →
          </button>
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

          <div className="aflip__actions">
            <button type="button" className="aflip__btn" onClick={() => setOpen(false)}>
              ← {labels.back}
            </button>
            <Link href={`/assets/${asset.id}/edit`} className="btn-primary aflip__edit">
              {labels.edit}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
