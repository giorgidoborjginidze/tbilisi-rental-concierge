import { z } from "zod";
import {
  DISTRICTS,
  HEATING_TYPES,
  LISTING_TYPES,
  PROPERTY_TYPES,
} from "./domain";

// The structured search criteria — the single contract shared by:
//   1. the AI-extraction layer (which must produce this shape), and
//   2. the matching engine (which consumes it).
//
// Every field is optional except `type`, which defaults to "rent". The AI is
// asked to emit exactly this JSON; we validate with Zod before trusting it.

export const SearchCriteriaSchema = z
  .object({
    type: z.enum(LISTING_TYPES).default("rent"),

    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).optional(),

    /** Preferred districts (canonical names). Acts as a hard gate when non-empty. */
    districts: z.array(z.enum(DISTRICTS)).optional(),

    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    currency: z.string().length(3).default("USD"),

    /** Total rooms (Georgian listings count the living room). */
    minRooms: z.number().int().nonnegative().optional(),
    exactRooms: z.number().int().nonnegative().optional(),

    minBedrooms: z.number().int().nonnegative().optional(),
    exactBedrooms: z.number().int().nonnegative().optional(),

    minAreaSqm: z.number().nonnegative().optional(),

    furnished: z.boolean().optional(),
    heating: z.enum(HEATING_TYPES).optional(),
    petsAllowed: z.boolean().optional(),

    /** ISO date (YYYY-MM-DD). Listing must be available on or before this date. */
    availableFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
      .optional(),

    /** Free-text signals that didn't map to a structured field. */
    keywords: z.array(z.string()).optional(),
  })
  .strict();

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;

/**
 * Parse arbitrary (AI- or user-provided) input into validated SearchCriteria.
 * Returns a discriminated result so callers can decide how to handle failures.
 */
export function parseCriteria(
  input: unknown,
):
  | { success: true; data: SearchCriteria }
  | { success: false; error: string } {
  const result = SearchCriteriaSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    error: result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}

/** The JSON shape we hand to Claude, as a plain object (for the prompt). */
export const CRITERIA_JSON_SHAPE = {
  type: '"rent" | "sale" (default "rent")',
  propertyTypes: '("apartment" | "house" | "studio" | "room")[] or omit',
  districts: `(${DISTRICTS.map((d) => `"${d}"`).join(" | ")})[] or omit`,
  minPrice: "number or omit",
  maxPrice: "number or omit",
  currency: '3-letter code, default "USD"',
  minRooms: "integer or omit",
  exactRooms: "integer or omit",
  minBedrooms: "integer or omit",
  exactBedrooms: "integer or omit",
  minAreaSqm: "number or omit",
  furnished: "boolean or omit",
  heating: '"central" | "gas" | "electric" | "none" or omit',
  petsAllowed: "boolean or omit",
  availableFrom: '"YYYY-MM-DD" or omit',
  keywords: "string[] or omit",
} as const;
