import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processPing } from "@/lib/geo/monitor";
import { flushOutbox } from "@/lib/notify/whatsapp";

// GPS ingest. Trackers (or the middleware in front of them) POST a
// position here; the device authenticates with the token issued when it
// was bound to the vehicle — no login session is involved.
//
//   POST /api/gps/ping
//   { "deviceId": "…", "token": "…", "lat": 41.71, "lng": 44.82,
//     "speed": 54, "at": "2026-08-31T10:00:00Z" }
//
// GET is accepted too, with the same fields as query parameters, because
// several cheap trackers can only fire a plain URL. That does put the
// device secret in a URL, where proxies and access logs can see it — an
// accepted, documented trade-off (see docs/compliance.md): the token
// authorises position reports for one vehicle and nothing else, and the
// owner can rotate it from the asset's rental page at any time.

export const dynamic = "force-dynamic";

interface PingBody {
  deviceId?: string;
  token?: string;
  lat?: number | string;
  lng?: number | string;
  speed?: number | string;
  at?: string;
}

/**
 * Constant-time token comparison. A plain `!==` returns faster the earlier
 * the strings differ, which is enough to recover a token one character at
 * a time from an endpoint that can be called as often as this one.
 */
function sameToken(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    // Still spend the comparison, so length is not leaked by timing either.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

const num = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

async function handle(body: PingBody) {
  const deviceId = String(body.deviceId ?? "").trim();
  const token = String(body.token ?? "").trim();
  const lat = num(body.lat);
  const lng = num(body.lng);

  if (!deviceId || !token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "invalid_position" }, { status: 400 });
  }

  const device = await prisma.gpsDevice.findUnique({ where: { deviceId } });
  if (!device || !sameToken(device.token, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const at = body.at ? new Date(body.at) : new Date();
  const outcomes = await processPing(device.assetId, {
    lat,
    lng,
    speed: num(body.speed),
    at: Number.isNaN(at.getTime()) ? new Date() : at,
  });

  // Deliver straight away when the Cloud API is configured; otherwise the
  // messages wait in the outbox for click-to-send.
  const queued = outcomes.some((outcome) => outcome.queued > 0);
  if (queued) await flushOutbox().catch(() => undefined);

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
  const body = (await request.json().catch(() => ({}))) as PingBody;
  return handle(body);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return handle({
    deviceId: params.get("deviceId") ?? params.get("id") ?? undefined,
    token: params.get("token") ?? undefined,
    lat: params.get("lat") ?? undefined,
    lng: params.get("lng") ?? params.get("lon") ?? undefined,
    speed: params.get("speed") ?? undefined,
    at: params.get("at") ?? undefined,
  });
}
