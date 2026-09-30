// Reading a GPS ping safely.
//
// A red line is only as trustworthy as the positions fed into it. Cheap
// trackers send an empty or 0,0 position when they have no satellite fix;
// a copied address with sample coordinates baked in would pin every car to
// central Tbilisi; a buffered old point must not overwrite a newer one; a
// timestamp from the future must not become "last seen". Everything that
// is not a real, fresh fix is refused here, before it can raise a false
// theft alarm or hide a real one.
//
// Pure (plus node:crypto for the token check), so the route and the tests
// share it.

import { createHash, timingSafeEqual } from "node:crypto";
import { EXAMPLE_POSITION } from "./presets";

/** Every value a field arrived with — a query string may repeat a key. */
export type PingFields = Record<string, (string | number | boolean | null | undefined)[]>;

export interface ParsedPing {
  deviceId: string;
  token: string;
  lat: number;
  lng: number;
  speed: number | null;
  /** The tracker's own time of the fix; null when it sent none. */
  at: Date | null;
}

export type PingError =
  | "unauthorized"
  | "duplicate_position"
  | "invalid_position"
  | "no_fix"
  | "example_position"
  | "invalid_timestamp"
  | "future_timestamp"
  | "stale_ping"
  | "rate_limited";

export const PING_ERROR_STATUS: Record<PingError, number> = {
  unauthorized: 401,
  duplicate_position: 400,
  invalid_position: 400,
  no_fix: 422,
  example_position: 422,
  invalid_timestamp: 400,
  future_timestamp: 400,
  stale_ping: 409,
  rate_limited: 429,
};

/** How far ahead of the server clock a fix may be stamped. */
export const MAX_FUTURE_MS = 5 * 60_000;
/** At most one accepted ping per device in this window. */
export const MIN_PING_INTERVAL_MS = 5_000;

const present = (values: PingFields[string] | undefined) =>
  (values ?? []).filter((value) => value !== undefined && value !== null);

/** First non-empty value of the first alias present, as a trimmed string. */
function text(fields: PingFields, ...names: string[]): string {
  for (const name of names) {
    const [first] = present(fields[name]);
    if (first !== undefined) return String(first).trim();
  }
  return "";
}

/**
 * A coordinate: exactly one value across its aliases, non-empty and
 * numeric. A second value means two positions were mixed into one request
 * (an address with coordinates baked in, plus the tracker's own), and
 * there is no telling which is real. `Number("")` is 0 — an empty "lat="
 * must not read as the equator.
 */
function coordinate(
  fields: PingFields,
  names: string[],
): { value: number } | { error: "duplicate_position" | "invalid_position" } {
  const values = names.flatMap((name) => present(fields[name]));
  if (values.length > 1) return { error: "duplicate_position" };
  if (values.length === 0) return { error: "invalid_position" };
  const raw = values[0];
  if (typeof raw === "boolean") return { error: "invalid_position" };
  const str = String(raw).trim();
  if (str === "") return { error: "invalid_position" };
  const value = typeof raw === "number" ? raw : Number(str);
  return Number.isFinite(value) ? { value } : { error: "invalid_position" };
}

/** A fix time: ISO text, or a Unix time in seconds or milliseconds. */
export function parseFixTime(raw: string): Date | null {
  if (raw === "") return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    // Seconds until the year 2286, milliseconds after.
    return new Date(n < 1e10 ? n * 1000 : n);
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Who is sending: the device id, and the token from a header
 * (`headerToken`, preferred — it stays out of URLs and proxy logs) or from
 * the fields.
 */
export function pingCredentials(
  fields: PingFields,
  headerToken?: string | null,
): { deviceId: string; token: string } | null {
  const deviceId = text(fields, "deviceId", "device_id", "id");
  const token = (headerToken ?? "").trim() || text(fields, "token");
  return deviceId && token ? { deviceId, token } : null;
}

/** Read a ping: the credentials, then one real fix. */
export function parsePing(
  fields: PingFields,
  headerToken?: string | null,
): { ok: true; ping: ParsedPing } | { ok: false; error: PingError } {
  const credentials = pingCredentials(fields, headerToken);
  if (!credentials) return { ok: false, error: "unauthorized" };
  const { deviceId, token } = credentials;

  const lat = coordinate(fields, ["lat", "latitude"]);
  if ("error" in lat) return { ok: false, error: lat.error };
  const lng = coordinate(fields, ["lng", "lon", "longitude"]);
  if ("error" in lng) return { ok: false, error: lng.error };
  if (lat.value < -90 || lat.value > 90 || lng.value < -180 || lng.value > 180) {
    return { ok: false, error: "invalid_position" };
  }
  // 0,0 is in the Gulf of Guinea: it is what a tracker without a fix sends.
  // Traccar also marks such records valid=false.
  const valid = text(fields, "valid").toLowerCase();
  if ((lat.value === 0 && lng.value === 0) || valid === "false" || valid === "0") {
    return { ok: false, error: "no_fix" };
  }

  // The sample position from the example line on the rental page: pasted
  // into a tracker verbatim it would report central Tbilisi forever.
  if (lat.value === EXAMPLE_POSITION.lat && lng.value === EXAMPLE_POSITION.lng) {
    return { ok: false, error: "example_position" };
  }

  const timeRaw = text(fields, "at", "timestamp", "fixTime");
  const at = parseFixTime(timeRaw);
  if (timeRaw !== "" && !at) return { ok: false, error: "invalid_timestamp" };

  const speedRaw = text(fields, "speed");
  const speed = speedRaw === "" ? null : Number(speedRaw);

  return {
    ok: true,
    ping: {
      deviceId,
      token,
      lat: lat.value,
      lng: lng.value,
      speed: speed != null && Number.isFinite(speed) && speed >= 0 ? speed : null,
      at,
    },
  };
}

/**
 * Is the fix time acceptable? A fix from the future (beyond a small clock
 * drift) is refused, and so is one no newer than the last accepted fix — a
 * buffered old point must not replace a newer position.
 */
export function checkFixTime(
  at: Date,
  lastPingAt: Date | null,
  now: Date,
): PingError | null {
  if (at.getTime() > now.getTime() + MAX_FUTURE_MS) return "future_timestamp";
  if (lastPingAt && at.getTime() <= lastPingAt.getTime()) return "stale_ping";
  return null;
}

/** Constant-time token comparison (hashing first makes the lengths equal). */
export function tokensMatch(expected: string, given: string): boolean {
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(given).digest();
  return timingSafeEqual(a, b);
}

/** Query string or form data as PingFields, keeping repeated keys. */
export function fieldsFromParams(params: {
  keys(): IterableIterator<string>;
  getAll(name: string): unknown[];
}): PingFields {
  const fields: PingFields = {};
  for (const key of new Set(params.keys())) {
    fields[key] = params
      .getAll(key)
      .filter((value): value is string => typeof value === "string");
  }
  return fields;
}

/** A JSON body as PingFields (nested Traccar-style `location.coords` too). */
export function fieldsFromJson(body: unknown): PingFields {
  const fields: PingFields = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return fields;
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object") return;
    (fields[key] ??= []).push(value as string | number | boolean);
  };
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) add(key, value);
  // { location: { coords: { latitude, longitude, speed }, timestamp } }
  const location = (body as { location?: unknown }).location;
  if (location && typeof location === "object") {
    const coords = (location as { coords?: unknown }).coords;
    if (coords && typeof coords === "object") {
      for (const [key, value] of Object.entries(coords as Record<string, unknown>)) {
        add(key, value);
      }
    }
    add("timestamp", (location as { timestamp?: unknown }).timestamp);
  }
  return fields;
}
