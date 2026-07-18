import type { SearchCriteria } from "../criteria";
import type { Language } from "../domain";
import type { MatchableListing, MatchReason } from "../matching/types";
import { AI_MODELS, getClient } from "./client";
import { stubExplainMatch } from "./stub";

// Generates the one-line "why this matches" shown on each result card. Uses
// Claude when configured; otherwise falls back to a deterministic stub built
// from the engine's structured reasons.

function factSheet(listing: MatchableListing): string {
  const facts: string[] = [
    `${listing.propertyType} in ${listing.district}`,
    `$${listing.price}/mo`,
  ];
  if (listing.rooms != null) facts.push(`${listing.rooms} rooms`);
  if (listing.bedrooms != null) facts.push(`${listing.bedrooms} bedrooms`);
  if (listing.areaSqm != null) facts.push(`${listing.areaSqm} m²`);
  facts.push(listing.furnished ? "furnished" : "unfurnished");
  if (listing.heating) facts.push(`${listing.heating} heating`);
  facts.push(listing.petsAllowed ? "pets allowed" : "no pets");
  return facts.join(", ");
}

export async function explainMatch(
  criteria: SearchCriteria,
  listing: MatchableListing,
  reasons: MatchReason[],
  language: Language = "en",
): Promise<string> {
  const client = getClient();
  if (!client) return stubExplainMatch(listing, reasons, language);

  try {
    const langName = language === "ka" ? "Georgian" : "English";
    const response = await client.messages.create({
      model: AI_MODELS.explanation,
      max_tokens: 120,
      system: `You write a single short sentence (max 20 words) explaining why a rental listing matches a renter's request. Be concrete and specific to this listing. Write in ${langName}. No preamble, no quotes, just the sentence.`,
      messages: [
        {
          role: "user",
          content: [
            `Renter wants: ${JSON.stringify(criteria)}`,
            `Listing facts: ${factSheet(listing)}`,
            `Top match signals: ${reasons.map((r) => r.label).join("; ") || "general fit"}`,
            `Write the one-line explanation.`,
          ].join("\n"),
        },
      ],
    });

    const text = response.content
      .filter(
        (b): b is Extract<typeof b, { type: "text" }> => b.type === "text",
      )
      .map((b) => b.text)
      .join(" ")
      .trim();

    return text || stubExplainMatch(listing, reasons, language);
  } catch (err) {
    console.warn(
      `[ai] explanation failed, using stub fallback: ${(err as Error).message}`,
    );
    return stubExplainMatch(listing, reasons, language);
  }
}
