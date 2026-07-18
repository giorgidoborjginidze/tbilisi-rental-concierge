import { NextResponse } from "next/server";
import { z } from "zod";
import { extractCriteria } from "@/lib/ai/extract";
import { prisma } from "@/lib/db";
import { LANGUAGES } from "@/lib/domain";
import { runMatchingForRequest } from "@/lib/match-service";

// POST /api/search-requests
// Intake: free text → Claude (or stub) → validated criteria → persisted
// SearchRequest → immediate matching run. Returns the request id + stats so the
// client can navigate straight to the results page.

const BodySchema = z.object({
  email: z.string().email(),
  query: z.string().min(5).max(2000),
  language: z.enum(LANGUAGES).default("en"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { email, query, language } = parsed.data;

  // Minimal auth: an email identifier is enough for the MVP.
  await prisma.user.upsert({
    where: { email },
    create: { email, locale: language },
    update: { locale: language },
  });

  const { criteria, source } = await extractCriteria(query);

  const searchRequest = await prisma.searchRequest.create({
    data: {
      userEmail: email,
      rawQuery: query,
      language,
      structuredCriteria: JSON.stringify(criteria),
      isActive: true,
    },
  });

  const outcome = await runMatchingForRequest(searchRequest.id);

  return NextResponse.json(
    {
      id: searchRequest.id,
      criteria,
      extractionSource: source,
      stats: outcome.stats,
    },
    { status: 201 },
  );
}
