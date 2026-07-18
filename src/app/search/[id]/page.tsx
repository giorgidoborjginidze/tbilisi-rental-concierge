import { notFound } from "next/navigation";
import { parseCriteria } from "@/lib/criteria";
import { prisma } from "@/lib/db";
import { parsePhotos } from "@/lib/listings";
import { parseReasons } from "@/lib/match-service";
import { ResultsView, type ResultsData } from "./results-view";

// Results page: server component loads the SearchRequest + ranked matches and
// hands a serializable payload to the client view (which owns i18n rendering).

export const dynamic = "force-dynamic";

export default async function SearchResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const request = await prisma.searchRequest.findUnique({ where: { id } });
  if (!request) notFound();

  const matches = await prisma.match.findMany({
    where: { searchRequestId: id },
    orderBy: { score: "desc" },
    include: { listing: true },
  });

  const parsedCriteria = parseCriteria(safeJson(request.structuredCriteria));

  const data: ResultsData = {
    id: request.id,
    rawQuery: request.rawQuery,
    criteria: parsedCriteria.success ? parsedCriteria.data : { type: "rent", currency: "USD" },
    isActive: request.isActive,
    matches: matches.map((m) => {
      const reasons = parseReasons(m.reasons);
      const l = m.listing;
      return {
        id: m.id,
        score: m.score,
        explanation: reasons.explanation,
        signals: reasons.signals.map((s) => s.label),
        listing: {
          id: l.id,
          sourceUrl: l.sourceUrl,
          propertyType: l.propertyType,
          district: l.district,
          addressApprox: l.addressApprox,
          price: l.price,
          currency: l.currency,
          areaSqm: l.areaSqm,
          rooms: l.rooms,
          bedrooms: l.bedrooms,
          floor: l.floor,
          furnished: l.furnished,
          heating: l.heating,
          petsAllowed: l.petsAllowed,
          availableFrom: l.availableFrom?.toISOString() ?? null,
          lastSeenAt: l.lastSeenAt.toISOString(),
          photos: parsePhotos(l.photos),
          rawText: l.rawText,
          rawTextKa: l.rawTextKa,
        },
      };
    }),
  };

  return <ResultsView data={data} />;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
