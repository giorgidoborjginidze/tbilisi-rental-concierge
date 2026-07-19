// DB-bound orchestration of the iCal sync: fetch each unit's feeds, parse,
// and upsert bookings deduped on (unitId, source, externalId). The fetcher
// is injectable so the whole flow is testable without a network.

import { prisma } from "@/lib/db";
import { parseChannelLinks } from "@/lib/types";
import { parseIcal } from "./parse";
import { eventsToBookings, sourceFromUrl } from "./sync";

export type IcalFetcher = (url: string) => Promise<string>;

export interface FeedSyncResult {
  unitId: string;
  unitName: string;
  url: string;
  source: string;
  created: number;
  updated: number;
  error?: string;
}

const defaultFetcher: IcalFetcher = async (url) => {
  const response = await fetch(url, {
    headers: { "User-Agent": "str-operator-dashboard/0.1 ical-sync" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
};

export async function syncAllUnits(
  fetchText: IcalFetcher = defaultFetcher,
  operatorId?: string,
): Promise<FeedSyncResult[]> {
  const units = await prisma.unit.findMany({
    where: operatorId ? { operatorId } : undefined,
  });
  const results: FeedSyncResult[] = [];

  for (const unit of units) {
    const { icalUrls } = parseChannelLinks(unit.channelLinks);
    for (const url of icalUrls) {
      const source = sourceFromUrl(url);
      const result: FeedSyncResult = {
        unitId: unit.id,
        unitName: unit.name,
        url,
        source,
        created: 0,
        updated: 0,
      };
      try {
        const text = await fetchText(url);
        const candidates = eventsToBookings(parseIcal(text), source);
        for (const candidate of candidates) {
          const where = {
            unitId_source_externalId: {
              unitId: unit.id,
              source: candidate.source,
              externalId: candidate.externalId,
            },
          };
          const existing = await prisma.booking.findUnique({ where });
          if (existing) {
            await prisma.booking.update({
              where,
              data: {
                checkIn: candidate.checkIn,
                checkOut: candidate.checkOut,
                nights: candidate.nights,
                status: candidate.status,
                importedAt: new Date(),
              },
            });
            result.updated += 1;
          } else {
            await prisma.booking.create({
              data: {
                unitId: unit.id,
                source: candidate.source,
                checkIn: candidate.checkIn,
                checkOut: candidate.checkOut,
                nights: candidate.nights,
                status: candidate.status,
                externalId: candidate.externalId,
                currency: unit.currency,
              },
            });
            result.created += 1;
          }
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      }
      results.push(result);
    }
  }
  return results;
}
