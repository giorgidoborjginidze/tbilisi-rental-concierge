import { explainMatch } from "./ai/explain";
import { parseCriteria, type SearchCriteria } from "./criteria";
import { prisma } from "./db";
import type { Language } from "./domain";
import { toMatchable } from "./listings";
import { runMatching } from "./matching/engine";
import type { MatchReason, MatchResult } from "./matching/types";

const STALE_AFTER_DAYS = Number(process.env.LISTING_STALE_AFTER_DAYS ?? 21);

// Persisted shape of Match.reasons: the AI/stub one-liner plus the structured
// signals that produced the score.
export interface MatchReasonsPayload {
  explanation: string;
  signals: MatchReason[];
}

export function parseReasons(json: string): MatchReasonsPayload {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && "explanation" in parsed) {
      return {
        explanation: String(parsed.explanation ?? ""),
        signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      };
    }
    // Back-compat: a bare array of signals.
    if (Array.isArray(parsed)) return { explanation: "", signals: parsed };
  } catch {
    /* fall through */
  }
  return { explanation: "", signals: [] };
}

export interface RunMatchingOutcome {
  stats: MatchResult["stats"];
  /** IDs of Match rows that are newly created in this run (were not matched before). */
  newMatchIds: string[];
}

/**
 * Run the matching engine for a SearchRequest against all active listings,
 * generate a one-line explanation per match, and persist Match rows. Existing
 * matches for the request are reconciled so the set always reflects the latest
 * run; the returned `newMatchIds` are those that did not exist before (used for
 * notifications).
 */
export async function runMatchingForRequest(
  searchRequestId: string,
): Promise<RunMatchingOutcome> {
  const request = await prisma.searchRequest.findUniqueOrThrow({
    where: { id: searchRequestId },
  });

  const parsed = parseCriteria(safeJson(request.structuredCriteria));
  const criteria: SearchCriteria = parsed.success
    ? parsed.data
    : { type: "rent", currency: "USD" };
  const language = (request.language as Language) ?? "en";

  const listings = await prisma.listing.findMany({ where: { isActive: true } });
  const result = runMatching(criteria, listings.map(toMatchable), {
    staleAfterDays: STALE_AFTER_DAYS,
  });

  // Which listings were already matched to this request before this run?
  const existing = await prisma.match.findMany({
    where: { searchRequestId },
    select: { listingId: true },
  });
  const previouslyMatched = new Set(existing.map((m) => m.listingId));

  const newMatchIds: string[] = [];

  // Generate explanations (parallel; stub is instant, AI is a handful of calls).
  const explained = await Promise.all(
    result.scored.map(async (s) => ({
      scored: s,
      explanation: await explainMatch(criteria, s.listing, s.reasons, language),
    })),
  );

  const keepListingIds = new Set(explained.map((e) => e.scored.listing.id));

  await prisma.$transaction(async (tx) => {
    // Remove stale matches that no longer qualify.
    await tx.match.deleteMany({
      where: {
        searchRequestId,
        listingId: { notIn: [...keepListingIds] },
      },
    });

    for (const { scored, explanation } of explained) {
      const payload: MatchReasonsPayload = {
        explanation,
        signals: scored.reasons,
      };
      const isNew = !previouslyMatched.has(scored.listing.id);
      const row = await tx.match.upsert({
        where: {
          searchRequestId_listingId: {
            searchRequestId,
            listingId: scored.listing.id,
          },
        },
        create: {
          searchRequestId,
          listingId: scored.listing.id,
          score: scored.score,
          reasons: JSON.stringify(payload),
          notified: false,
        },
        update: {
          score: scored.score,
          reasons: JSON.stringify(payload),
        },
      });
      if (isNew) newMatchIds.push(row.id);
    }
  });

  return { stats: result.stats, newMatchIds };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
