// Reading what the admin pastes or uploads on /admin/market. Pure.
//
//   Report figures, one per line:   district, metric, value[, sample]
//     "ვაკე, ქირა, 32"  ·  "Saburtalo, sale_sqm, 3300"  ·  "Vera, occupancy, 68%"
//   Listings (CSV/TSV with a header row; extra columns are ignored):
//     district | type (rent/sale, ქირა/იყიდება) | price | currency | area
//   Only district aggregates leave this module — never a listing.

import { districtKey } from "@/lib/places";
import { asCurrency, toGel, type GelRates } from "@/lib/fx/convert";
import { trimmedMedian, type MarketMetric } from "./blend";

const METRIC_ALIASES: Record<string, MarketMetric> = {
  rent: "rent_sqm", rent_sqm: "rent_sqm", "ქირა": "rent_sqm", "ქირა/მ²": "rent_sqm",
  sale: "sale_sqm", sale_sqm: "sale_sqm", price: "sale_sqm", "ფასი": "sale_sqm", "გაყიდვა": "sale_sqm",
  adr: "adr", night: "adr", "ღამე": "adr",
  occupancy: "occupancy", "დატვირთვა": "occupancy",
};

export interface ParsedFigure {
  district: string;
  metric: MarketMetric;
  value: number;
  sampleSize: number;
}

/** "120,000" and "120 000" are thousands; "32,5" is a decimal comma. */
function num(text: string): number {
  let clean = text.replace(/[\s\u00a0₾$€]/g, "");
  if (clean.includes(",") && clean.includes(".")) clean = clean.replace(/,/g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(clean)) clean = clean.replace(/,/g, "");
  else clean = clean.replace(",", ".");
  return Number(clean);
}

export function parseFigureLines(text: string): { figures: ParsedFigure[]; badLines: number[] } {
  const figures: ParsedFigure[] = [];
  const badLines: number[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const cells = line.split(/[;\t]|,(?=\s*[^\d\s])|,(?=\s*\d)/).map((cell) => cell.trim()).filter(Boolean);
    const [districtText, metricText, valueText, sampleText] = cells;
    const district = districtKey(districtText);
    const metric = METRIC_ALIASES[(metricText ?? "").toLowerCase()];
    const percent = (valueText ?? "").includes("%");
    let value = num((valueText ?? "").replace("%", ""));
    if (metric === "occupancy" && (percent || value > 1)) value /= 100;
    if (!district || !metric || !Number.isFinite(value) || value <= 0 || (metric === "occupancy" && value > 1)) {
      badLines.push(index + 1);
      return;
    }
    const sample = sampleText ? Math.max(0, Math.round(num(sampleText))) : 0;
    figures.push({ district, metric, value, sampleSize: Number.isFinite(sample) ? sample : 0 });
  });
  return { figures, badLines };
}

/** Splits one CSV/TSV line, quotes respected. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

const HEADER: Record<string, string[]> = {
  district: ["district", "raion", "უბანი", "რაიონი", "location"],
  type: ["type", "deal", "deal_type", "გარიგება", "ტიპი", "transaction"],
  price: ["price", "ფასი", "amount"],
  currency: ["currency", "ვალუტა", "cur"],
  area: ["area", "area_sqm", "sqm", "m2", "ფართი", "ფართობი"],
};

export interface Listing {
  district: string;
  deal: "rent" | "sale";
  priceGel: number;
  area: number;
}

export function parseListings(text: string, rates: GelRates): { listings: Listing[]; skipped: number; missing: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { listings: [], skipped: 0, missing: ["header"] };
  const delimiter = [";", "\t", ","].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const head = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());
  const col = (name: string) => head.findIndex((h) => HEADER[name].includes(h));
  const at = { district: col("district"), type: col("type"), price: col("price"), currency: col("currency"), area: col("area") };
  const missing = (["district", "type", "price", "area"] as const).filter((key) => at[key] < 0);
  if (missing.length) return { listings: [], skipped: lines.length - 1, missing };
  const listings: Listing[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delimiter);
    const district = districtKey(cells[at.district]);
    const typeText = (cells[at.type] ?? "").toLowerCase();
    const deal = /rent|ქირ|lease/.test(typeText) ? "rent" : /sale|sell|იყიდ|გაყიდ|buy/.test(typeText) ? "sale" : null;
    const price = num(cells[at.price] ?? "");
    const area = num(cells[at.area] ?? "");
    const currency = at.currency >= 0 ? asCurrency((cells[at.currency] ?? "GEL").toUpperCase().replace("₾", "GEL").replace("$", "USD")) : "GEL";
    if (!district || !deal || !(price > 0) || !(area >= 10 && area <= 2000)) {
      skipped += 1;
      continue;
    }
    listings.push({ district, deal, priceGel: toGel(price, currency, rates), area });
  }
  return { listings, skipped, missing: [] };
}

/** Per district: the rent and sale price per m², from at least `minimum` listings each. */
export function aggregateListings(listings: Listing[], minimum = 5): ParsedFigure[] {
  const groups = new Map<string, number[]>();
  for (const listing of listings) {
    const key = `${listing.district}|${listing.deal}`;
    groups.set(key, [...(groups.get(key) ?? []), listing.priceGel / listing.area]);
  }
  const out: ParsedFigure[] = [];
  for (const [key, values] of groups) {
    if (values.length < minimum) continue;
    const [district, deal] = key.split("|");
    const value = trimmedMedian(values);
    if (value == null) continue;
    out.push({ district, metric: deal === "rent" ? "rent_sqm" : "sale_sqm", value: Math.round(value * 100) / 100, sampleSize: values.length });
  }
  return out;
}
