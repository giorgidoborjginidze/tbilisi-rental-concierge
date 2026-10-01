import { prisma } from "@/lib/db";
import { loadRentalPlaces } from "@/lib/property/places";
import { dayFills, placeStays } from "@/lib/property/stays";
import { asChannel, buildIcs, staysFor } from "@/lib/ical/export";
import { startOfTodayTbilisi } from "@/lib/time";

// A unit's calendar for Airbnb / Booking.com to import (lib/ical/export.ts).
// The token is the only key: whoever has the address sees which nights are
// taken — nothing else. ?for=airbnb / ?for=booking leaves out that
// channel's own stays. An unknown token answers 404.
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  const exported = token
    ? await prisma.calendarExport.findUnique({
        where: { token },
        select: { unit: { select: { id: true, operatorId: true, name: true } } },
      })
    : null;
  if (!exported) return new Response("Not found", { status: 404 });

  const now = new Date();
  const today = startOfTodayTbilisi(now);
  // From a month back (a stay in progress) to two years ahead.
  const range = { start: new Date(today.getTime() - 31 * DAY_MS), end: new Date(today.getTime() + 731 * DAY_MS) };
  const [place] = await loadRentalPlaces(exported.unit.operatorId, range, { unitId: exported.unit.id });
  const stays = place ? [...placeStays(place.sources), ...dayFills(place.sources)] : [];

  const channel = asChannel(new URL(request.url).searchParams.get("for"));
  const body = buildIcs({
    name: exported.unit.name,
    stays: staysFor(
      stays.map((stay) => ({ id: `${exported.unit.id}-${stay.id}`, kind: stay.kind, start: stay.start, end: stay.end })),
      channel,
    ),
    now,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="activo-${exported.unit.id}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
