import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processPing } from "@/lib/geo/monitor";
import {
  checkFixTime,
  fieldsFromJson,
  fieldsFromParams,
  MIN_PING_INTERVAL_MS,
  parsePing,
  pingCredentials,
  PING_ERROR_STATUS,
  tokensMatch,
  type PingError,
  type PingFields,
} from "@/lib/geo/ping";
import { flushOutbox } from "@/lib/notify/whatsapp";

// GPS ingest. Trackers do not call this by themselves: the installer or the
// tracking provider (usually a Traccar server forwarding positions) is set
// up with this address. The device authenticates with the token issued when
// it was bound to the vehicle — no login session is involved.
//
//   POST /api/gps/ping                      (preferred)
//   Authorization: Bearer <token>           (or X-Device-Token, or "token" in the body)
//   { "deviceId": "…", "lat": 41.71, "lng": 44.82,
//     "speed": 54, "at": "2026-08-31T10:00:00Z" }
//
// Form-encoded POST bodies are read the same way. GET with the same fields
// as query parameters is kept for cheap trackers that can only fire a URL —
// the token then travels in the URL, so rotate it if it leaks.
//
// A ping is refused unless it is one real, fresh fix: a position repeated
// in the request, an empty or non-numeric one, 0,0 (no satellite fix), a
// fix stamped more than five minutes ahead, one no newer than the last
// accepted fix, or more than one ping per device every five seconds.

export const dynamic = "force-dynamic";

const refuse = (error: PingError) =>
  NextResponse.json(
    { error },
    {
      status: PING_ERROR_STATUS[error],
      headers:
        error === "rate_limited"
          ? { "Retry-After": String(Math.ceil(MIN_PING_INTERVAL_MS / 1000)) }
          : undefined,
    },
  );

/** The token from a header, when the sender keeps it out of the URL. */
function headerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  return bearer?.[1]?.trim() || request.headers.get("x-device-token")?.trim() || null;
}

async function handle(fields: PingFields, token: string | null) {
  // Credentials first: a sender without the device's token learns nothing
  // about why its position would have been refused.
  const credentials = pingCredentials(fields, token);
  const device = credentials
    ? await prisma.gpsDevice.findUnique({
        where: { deviceId: credentials.deviceId },
        include: { asset: { select: { operatorId: true } } },
      })
    : null;
  if (!credentials || !device || !tokensMatch(device.token, credentials.token)) {
    return refuse("unauthorized");
  }

  const parsed = parsePing(fields, token);
  if (!parsed.ok) return refuse(parsed.error);

  const now = new Date();
  const at = parsed.ping.at ?? now;
  const timeError = checkFixTime(at, device.lastPingAt, now);
  if (timeError) return refuse(timeError);

  // At most one accepted ping per device every few seconds — claimed
  // atomically, so two concurrent requests cannot both pass.
  const claimed = await prisma.gpsDevice.updateMany({
    where: {
      id: device.id,
      OR: [
        { lastReceivedAt: null },
        { lastReceivedAt: { lte: new Date(now.getTime() - MIN_PING_INTERVAL_MS) } },
      ],
    },
    data: { lastReceivedAt: now },
  });
  if (claimed.count === 0) return refuse("rate_limited");

  const outcomes = await processPing(device.assetId, {
    lat: parsed.ping.lat,
    lng: parsed.ping.lng,
    speed: parsed.ping.speed,
    at,
  });

  // Deliver straight away when the Cloud API is configured; otherwise the
  // messages wait in the outbox for click-to-send. Only this vehicle's
  // owner's outbox: a ping never sends another customer's messages.
  const queued = outcomes.some((outcome) => outcome.queued > 0);
  if (queued) await flushOutbox(device.asset.operatorId).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    fences: outcomes.map((outcome) => ({
      name: outcome.fenceName,
      zone: outcome.zone,
      distanceKm: Math.round(outcome.distanceKm * 100) / 100,
      event: outcome.event,
    })),
  });
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  let fields: PingFields = {};
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (form) fields = fieldsFromParams(form);
  } else {
    fields = fieldsFromJson(await request.json().catch(() => ({})));
  }
  // Query parameters on a POST count too (and are checked for repeats).
  const query = fieldsFromParams(new URL(request.url).searchParams);
  for (const [key, values] of Object.entries(query)) {
    fields[key] = [...(fields[key] ?? []), ...values];
  }
  return handle(fields, headerToken(request));
}

export async function GET(request: Request) {
  return handle(fieldsFromParams(new URL(request.url).searchParams), headerToken(request));
}
