import { parseCriteria, type SearchCriteria } from "../criteria";
import {
  DISTRICTS,
  HEATING_TYPES,
  LISTING_TYPES,
  PROPERTY_TYPES,
} from "../domain";
import { AI_MODELS, getClient } from "./client";
import { stubExtractCriteria } from "./stub";

export interface ExtractionResult {
  criteria: SearchCriteria;
  /** Where the criteria came from — useful for the UI and for tests. */
  source: "ai" | "stub";
}

// A strict JSON Schema handed to Claude as a tool, forcing structured output.
const CRITERIA_TOOL = {
  name: "record_search_criteria",
  description:
    "Record the structured rental-search criteria extracted from the user's free-text request. Omit any field the user did not clearly express — never guess.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: [...LISTING_TYPES] },
      propertyTypes: {
        type: "array",
        items: { type: "string", enum: [...PROPERTY_TYPES] },
      },
      districts: {
        type: "array",
        items: { type: "string", enum: [...DISTRICTS] },
      },
      minPrice: { type: "number" },
      maxPrice: { type: "number" },
      currency: { type: "string", description: "3-letter code, default USD" },
      minRooms: { type: "integer" },
      exactRooms: { type: "integer" },
      minBedrooms: { type: "integer" },
      exactBedrooms: { type: "integer" },
      minAreaSqm: { type: "number" },
      furnished: { type: "boolean" },
      heating: { type: "string", enum: [...HEATING_TYPES] },
      petsAllowed: { type: "boolean" },
      availableFrom: {
        type: "string",
        description: "ISO date YYYY-MM-DD; the earliest the user can move in",
      },
      keywords: { type: "array", items: { type: "string" } },
    },
    required: ["type"],
  },
};

const SYSTEM_PROMPT = `You convert a renter's free-text request into structured search criteria for Tbilisi, Georgia.
Rules:
- The user may write in English or Georgian. Understand both.
- Map neighbourhood names to the canonical district enum. "Old Town" maps to "Sololaki".
- Only include fields the user clearly expressed. Do not invent budgets, districts, or dates.
- Prices are monthly unless stated otherwise. Assume USD unless another currency is named.
- Interpret "N-bedroom" as minBedrooms=N (unless the user says "exactly").
- For availability like "from September", output the next upcoming first-of-month as YYYY-MM-DD.
- Default "type" to "rent".
Call the record_search_criteria tool exactly once with the result.`;

/**
 * Extract structured criteria from free text. Uses Claude when an API key is
 * configured; otherwise (or on any failure) falls back to the deterministic stub.
 */
export async function extractCriteria(
  rawQuery: string,
  opts: { now?: Date } = {},
): Promise<ExtractionResult> {
  const client = getClient();
  const now = opts.now ?? new Date();

  if (!client) {
    return { criteria: stubExtractCriteria(rawQuery, now), source: "stub" };
  }

  try {
    const todayIso = now.toISOString().slice(0, 10);
    const response = await client.messages.create({
      model: AI_MODELS.extraction,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [CRITERIA_TOOL],
      tool_choice: { type: "tool", name: CRITERIA_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Today is ${todayIso}. Extract criteria from:\n\n"""${rawQuery}"""`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Extract<typeof block, { type: "tool_use" }> =>
        block.type === "tool_use",
    );

    if (!toolUse) throw new Error("model did not call the criteria tool");

    const parsed = parseCriteria(toolUse.input);
    if (!parsed.success) {
      throw new Error(`invalid criteria from model: ${parsed.error}`);
    }
    return { criteria: parsed.data, source: "ai" };
  } catch (err) {
    console.warn(
      `[ai] extraction failed, using stub fallback: ${(err as Error).message}`,
    );
    return { criteria: stubExtractCriteria(rawQuery, now), source: "stub" };
  }
}
