// One-line rationale text for pricing suggestions.
//
// With ANTHROPIC_API_KEY set, Claude (claude-haiku-4-5 — cheap text
// generation) writes all rationales for a unit in a single request. Without
// a key — or on any API error — a deterministic local stub produces the
// same shape, so the app always runs.

import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/lib/i18n/strings";
import type { PricingResult } from "@/lib/pricing/engine";

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

const REASON_TEXT: Record<Locale, Record<string, string>> = {
  en: {
    high_season: "peak season demand",
    low_season: "low season",
    high_occupancy: "your calendar is nearly full",
    low_occupancy: "low upcoming occupancy",
    below_benchmark: `still below the district average`,
    above_benchmark: "above the district average",
  },
  ka: {
    high_season: "პიკური სეზონის მოთხოვნა",
    low_season: "დაბალი სეზონი",
    high_occupancy: "კალენდარი თითქმის სავსეა",
    low_occupancy: "დაბალი მოახლოებული დატვირთულობა",
    below_benchmark: "ჯერ კიდევ უბნის საშუალოზე დაბალია",
    above_benchmark: "უბნის საშუალოზე მაღალია",
  },
};

export function stubRationale(
  request: RationaleRequest,
  context: RationaleContext,
): string {
  const { result } = request;
  const { locale } = context;
  const direction =
    result.suggestedRate > context.baseNightlyRate
      ? locale === "ka" ? "აწეული" : "raised"
      : result.suggestedRate < context.baseNightlyRate
        ? locale === "ka" ? "დაწეული" : "lowered"
        : locale === "ka" ? "უცვლელი" : "kept at base";

  const reasonText = result.reasons
    .map((reason) => REASON_TEXT[locale][reason])
    .filter(Boolean)
    .join(locale === "ka" ? ", " : ", ");

  return locale === "ka"
    ? `ტარიფი ${direction}${reasonText ? ` — ${reasonText}` : ""}.`
    : `Rate ${direction}${reasonText ? " — " + reasonText : ""}.`;
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
        `nightly rate to the property operator. Respond with a JSON array of strings, one per row, in order. ` +
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
