import Anthropic from "@anthropic-ai/sdk";

// Thin wrapper around the Anthropic SDK. The API key comes only from the
// environment — never hardcoded. When it's absent, `isAiEnabled` is false and
// callers fall back to a deterministic local stub so the app still runs.

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

export const isAiEnabled = Boolean(apiKey);

export const AI_MODELS = {
  extraction: process.env.ANTHROPIC_EXTRACTION_MODEL?.trim() || "claude-haiku-4-5",
  explanation:
    process.env.ANTHROPIC_EXPLANATION_MODEL?.trim() || "claude-sonnet-5",
} as const;

let client: Anthropic | null = null;

export function getClient(): Anthropic | null {
  if (!isAiEnabled) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
