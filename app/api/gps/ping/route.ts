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
import { checkTrackerSilenceSoon } from "@/lib/geo/silence-check";

// GPS ingest. Trackers do not call this by themselves: a gateway (a Wialon
// retranslator per unit, or a small relay behind Traccar that maps each IMEI
// to its token — Traccar's own forward URL is global) posts here. The device
// authenticates with the token issued when it was bound to the vehicle — no
// login session is involved. See docs/gps-setup.md.
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
//
// `?test=1` only checks the device and token and answers { ok, test }: the
// rental page's "Check the address" button, so an owner can tell a wrong
// address from a tracker that is not sending yet.

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

async function handle(fields: PingFields, token: string | null, test = false) {
  // Credentials first: a sender without the device's token learns nothing
  // about why its position would have been refused.
  const credentials = pingCredentials(fields, token);
  const device = credentials
    ? await prisma.gpsDevice.findUnique({
        where: { deviceId: credentials.deviceId },
        include: { asset: { select: { operatorId: true, operator: { select: { isDemo: true } } } } },
      })
    : null;
  if (!credentials || !device || !tokensMatch(device.token, credentials.token)) {
    return refuse("unauthorized");
  }
  // "Check the address" on the rental page (?test=1): the device and token
  // are right — and nothing else happens, the car stays where it was.
  if (test) return NextResponse.json({ ok: true, test: true });
  // The shared demo is read-only: its trackers' tokens are visible to every
  // visitor, so their positions are not moved from outside.
  if (device.asset.operator.isDemo) {
    return NextResponse.json({ error: "demo_readonly" }, { status: 403 });
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
  // This car spoke; another of the workspace's cars may have gone quiet.
  await checkTrackerSilenceSoon(device.asset.operatorId, now);

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
  return handle(fields, headerToken(request), isTest(request));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle(fieldsFromParams(params), headerToken(request), isTest(request));
}

/** A check of the address and token from the rental page, not a position. */
function isTest(request: Request): boolean {
  return new URL(request.url).searchParams.get("test") === "1";
}
