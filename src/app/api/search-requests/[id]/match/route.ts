import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runMatchingForRequest } from "@/lib/match-service";

// POST /api/search-requests/:id/match
// Re-run the matching engine for an existing SearchRequest (e.g. after new
// listings arrive, or from the "re-run" button on the results page).

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const exists = await prisma.searchRequest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json(
      { error: "Search request not found" },
      { status: 404 },
    );
  }

  const outcome = await runMatchingForRequest(id);
  return NextResponse.json({
    id,
    stats: outcome.stats,
    newMatches: outcome.newMatchIds.length,
  });
}
