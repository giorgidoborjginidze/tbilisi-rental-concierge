"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { SearchCriteria } from "@/lib/criteria";
import { DISTRICT_KA, type District } from "@/lib/domain";

export interface ResultsListing {
  id: string;
  sourceUrl: string;
  propertyType: string;
  district: string;
  addressApprox: string;
  price: number;
  currency: string;
  areaSqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  floor: number | null;
  furnished: boolean;
  heating: string | null;
  petsAllowed: boolean;
  availableFrom: string | null;
  lastSeenAt: string;
  photos: string[];
  rawText: string | null;
  rawTextKa: string | null;
}

export interface ResultsMatch {
  id: string;
  score: number;
  explanation: string;
  signals: string[];
  listing: ResultsListing;
}

export interface ResultsData {
  id: string;
  rawQuery: string;
  criteria: SearchCriteria;
  isActive: boolean;
  matches: ResultsMatch[];
}

function districtLabel(district: string, lang: "en" | "ka"): string {
  if (lang === "ka") return DISTRICT_KA[district as District] ?? district;
  return district;
}

function formatMoney(price: number, currency: string): string {
  return currency === "USD" ? `$${price}` : `${price} ${currency}`;
}

export function ResultsView({ data }: { data: ResultsData }) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [rerunning, setRerunning] = useState(false);

  async function rerun() {
    setRerunning(true);
    try {
      await fetch(`/api/search-requests/${data.id}/match`, { method: "POST" });
      router.refresh();
    } finally {
      setRerunning(false);
    }
  }

  const c = data.criteria;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("results.heading")}
        </h1>
        <p className="text-sm text-slate-500">
          {t("results.for")}: “{data.rawQuery}”
        </p>
      </div>

      {/* Understood criteria */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <p className="mb-2 font-medium text-slate-700">
          {t("results.criteria")}:
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip label={t("criteria.type")} value={t(c.type === "sale" ? "common.sale" : "common.rent")} />
          <Chip
            label={t("criteria.districts")}
            value={
              c.districts?.length
                ? c.districts.map((d) => districtLabel(d, lang)).join(", ")
                : t("criteria.any")
            }
          />
          <Chip
            label={t("criteria.budget")}
            value={
              c.maxPrice !== undefined
                ? `≤ ${formatMoney(c.maxPrice, c.currency)}`
                : t("criteria.any")
            }
          />
          {(c.exactRooms ?? c.minRooms) !== undefined && (
            <Chip
              label={t("criteria.rooms")}
              value={
                c.exactRooms !== undefined ? `= ${c.exactRooms}` : `≥ ${c.minRooms}`
              }
            />
          )}
          {(c.exactBedrooms ?? c.minBedrooms) !== undefined && (
            <Chip
              label={t("criteria.bedrooms")}
              value={
                c.exactBedrooms !== undefined
                  ? `= ${c.exactBedrooms}`
                  : `≥ ${c.minBedrooms}`
              }
            />
          )}
          {c.furnished !== undefined && (
            <Chip
              label={t("criteria.furnished")}
              value={t(c.furnished ? "common.yes" : "common.no")}
            />
          )}
          {c.heating !== undefined && (
            <Chip label={t("criteria.heating")} value={c.heating} />
          )}
          {c.petsAllowed !== undefined && (
            <Chip
              label={t("criteria.pets")}
              value={t(c.petsAllowed ? "common.yes" : "common.no")}
            />
          )}
          {c.availableFrom !== undefined && (
            <Chip label={t("criteria.availableFrom")} value={c.availableFrom} />
          )}
        </div>
      </div>

      {/* Saved-search note + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-500">
          {data.isActive && <>💾 {t("results.savedSearch")}</>}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={rerun}
            disabled={rerunning}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {rerunning ? "…" : t("results.rerun")}
          </button>
          <Link
            href="/"
            className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700"
          >
            {t("results.newSearch")}
          </Link>
        </div>
      </div>

      {/* Matches */}
      {data.matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {t("results.none")}
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-600">
            {data.matches.length} {t("results.count")}
          </p>
          <ul className="space-y-4">
            {data.matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-800">{value}</span>
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone =
    pct >= 75
      ? "bg-emerald-100 text-emerald-800"
      : pct >= 55
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {pct}%
    </span>
  );
}

function MatchCard({ match }: { match: ResultsMatch }) {
  const { lang, t } = useLanguage();
  const l = match.listing;
  const description = lang === "ka" ? (l.rawTextKa ?? l.rawText) : l.rawText;

  const facts: string[] = [];
  if (l.rooms != null) facts.push(`${l.rooms} ${t("listing.rooms")}`);
  if (l.bedrooms != null) facts.push(`${l.bedrooms} ${t("listing.bedrooms")}`);
  if (l.areaSqm != null) facts.push(`${l.areaSqm} ${t("listing.sqm")}`);
  if (l.floor != null) facts.push(`${t("listing.floor")} ${l.floor}`);
  facts.push(l.furnished ? t("listing.furnished") : t("listing.unfurnished"));
  if (l.heating) facts.push(`${l.heating} ${t("listing.heating")}`);
  facts.push(l.petsAllowed ? t("listing.petsOk") : t("listing.noPets"));

  const availability = (() => {
    if (!l.availableFrom) return t("listing.availableNow");
    const d = new Date(l.availableFrom);
    if (d.getTime() <= Date.now()) return t("listing.availableNow");
    return `${t("listing.available")}: ${d.toLocaleDateString(lang === "ka" ? "ka-GE" : "en-US", { month: "short", day: "numeric" })}`;
  })();

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              {districtLabel(l.district, lang)} · {l.addressApprox}
            </h2>
            <p className="text-sm text-slate-500">{availability}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-lg font-bold text-brand-700">
              {formatMoney(l.price, l.currency)}
              <span className="text-sm font-normal text-slate-500">
                {t("listing.month")}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{t("results.score")}</span>
              <ScoreBadge score={match.score} />
            </div>
          </div>
        </div>

        {match.explanation && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
            <span className="font-medium">✨ {t("results.why")}:</span>{" "}
            {match.explanation}
          </p>
        )}

        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
          {facts.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </p>

        {description && (
          <p className="text-sm leading-relaxed text-slate-500">{description}</p>
        )}

        <div className="pt-1">
          <a
            href={l.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {t("results.viewSource")} ↗
          </a>
        </div>
      </div>
    </li>
  );
}
