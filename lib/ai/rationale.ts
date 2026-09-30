// One-line rationale text for pricing suggestions.
//
// With ANTHROPIC_API_KEY set, Claude (claude-haiku-4-5 — cheap text
// generation) writes all rationales for a unit in a single request. Without
// a key — or on any API error — a deterministic local stub produces the
// same shape, so the app always runs.

import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/lib/i18n/strings";
import type { PricingResult } from "@/lib/pricing/engine";
import { formatMoney } from "@/lib/format";

export interface RationaleRequest {
  date: Date;
  result: PricingResult;
  currency: string;
}

export interface RationaleContext {
  unitName: string;
  district: string;
  city: string;
  baseNightlyRate: number;
  locale: Locale;
}

// Each force that moved the price, said in the direction it moved it.
// {s} seasonality factor, {d} demand factor, {adr} district average.
const REASON_TEXT: Record<Locale, Record<string, string>> = {
  en: {
    high_season: "the season raises it (×{s})",
    low_season: "the low season lowers it (×{s})",
    high_occupancy: "a nearly full calendar raises it (×{d})",
    low_occupancy: "few bookings ahead lower it (×{d})",
    below_benchmark: "the district average ({adr}) pulls it up",
    above_benchmark: "the district average ({adr}) pulls it down",
    at_floor: "held at the lowest price (60% of base)",
    at_ceiling: "held at the highest price (180% of base)",
  },
  ka: {
    high_season: "სეზონი ზრდის (×{s})",
    low_season: "დაბალი სეზონი ამცირებს (×{s})",
    high_occupancy: "თითქმის სავსე კალენდარი ზრდის (×{d})",
    low_occupancy: "წინ ცოტა ჯავშანია — ამცირებს (×{d})",
    below_benchmark: "უბნის საშუალო ({adr}) ზემოთ სწევს",
    above_benchmark: "უბნის საშუალო ({adr}) ქვემოთ სწევს",
    at_floor: "დაჭერილია ყველაზე დაბალ ფასზე (საბაზოს 60%)",
    at_ceiling: "დაჭერილია ყველაზე მაღალ ფასზე (საბაზოს 180%)",
  },
};

const factor = (v: number) => v.toFixed(2);

/**
 * "Below base: the low season lowers it (×0.90); the district average
 * (135 ₾) pulls it up." — the direction first, then every force with the
 * way it pushed. Never "lowered … still below the average" without saying
 * which force did what.
 */
export function stubRationale(
  request: RationaleRequest,
  context: RationaleContext,
): string {
  const { result } = request;
  const { locale } = context;
  const direction =
    result.suggestedRate > context.baseNightlyRate
      ? locale === "ka" ? "საბაზოზე მაღალი" : "Above base"
      : result.suggestedRate < context.baseNightlyRate
        ? locale === "ka" ? "საბაზოზე დაბალი" : "Below base"
        : locale === "ka" ? "საბაზოს ტოლი" : "At base";

  const adr = result.factors.benchmarkAdr;
  const reasonText = result.reasons
    .map((reason) => REASON_TEXT[locale][reason])
    .filter(Boolean)
    .map((text) =>
      text
        .replace("{s}", factor(result.factors.seasonality))
        .replace("{d}", factor(result.factors.demand))
        .replace("{adr}", adr == null ? "—" : formatMoney(adr, request.currency)),
    )
    .join("; ");

  return `${direction}${reasonText ? `: ${reasonText}` : ""}.`;
}

export async function generateRationales(
  requests: RationaleRequest[],
  context: RationaleContext,
): Promise<string[]> {
  const fallback = requests.map((request) => stubRationale(request, context));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || requests.length === 0) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const language = context.locale === "ka" ? "Georgian" : "English";
    const lines = requests
      .map(
        (r, i) =>
          `${i}: date=${r.date.toISOString().slice(0, 10)}, suggested=${r.result.suggestedRate} ${r.currency}, ` +
          `base=${context.baseNightlyRate}, seasonality=${r.result.factors.seasonality}, ` +
          `demand=${r.result.factors.demand}, benchmarkAdr=${r.result.factors.benchmarkAdr ?? "n/a"}, ` +
          `reasons=[${r.result.reasons.join(",")}]`,
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system:
        `You write one-line pricing rationales for a short-term-rental dashboard, in ${language}. ` +
        `For each input row, output exactly one plain-text sentence (max ~20 words) explaining the suggested ` +
        `nightly rate to the property operator. Name each force in the direction it moved the price ` +
        `(seasonality < 1 lowers it, > 1 raises it; the district average pulls it toward itself), and ` +
        `never call the rate lowered and "still below average" without saying which force did what. ` +
        `Address the operator informally. Respond with a JSON array of strings, one per row, in order. ` +
        `No markdown, no extra keys.`,
      messages: [
        {
          role: "user",
          content: `Unit "${context.unitName}" in ${context.district}, ${context.city}.\n${lines}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return fallback;
    const parsed: unknown = JSON.parse(block.text);
    if (
      Array.isArray(parsed) &&
      parsed.length === requests.length &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
