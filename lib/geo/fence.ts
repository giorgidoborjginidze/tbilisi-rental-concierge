// Geofencing — the "red lines" a rented vehicle must stay inside.
//
// A fence is either a circle (a centre and a radius, e.g. "within 40 km of
// Tbilisi") or a polygon drawn by the owner. For every GPS ping we need
// three things: is the car inside, how far is the boundary, and did that
// answer just change? Only a change fires a message — a car parked just
// outside the line must not re-notify on every ping.
//
// Pure maths, no database and no framework.

export interface LatLng {
  lat: number;
  lng: number;
}

/** Polygon points are [lat, lng] pairs, as stored in Geofence.points. */
export type PolygonPoints = [number, number][];

export type FenceShape =
  | { kind: "circle"; centerLat: number; centerLng: number; radiusKm: number }
  | { kind: "polygon"; points: PolygonPoints };

/** Where the vehicle stands relative to one fence. */
export type Zone =
  | "safe" // inside, and further than approachKm from the boundary
  | "approach" // inside, but within approachKm of the boundary
  | "outside"; // over the line

export type Transition = "approach" | "breach" | "return";

export interface FenceReading {
  inside: boolean;
  /** Distance to the boundary in km — always positive, on either side. */
  distanceKm: number;
  zone: Zone;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Over a city-sized area a flat projection is accurate to well under the
// GPS error itself, and it makes segment maths trivial.
const project = (p: LatLng, origin: LatLng) => ({
  x: toRad(p.lng - origin.lng) * Math.cos(toRad(origin.lat)) * EARTH_RADIUS_KM,
  y: toRad(p.lat - origin.lat) * EARTH_RADIUS_KM,
});

/** Ray casting; points on an edge count as inside. */
export function pointInPolygon(point: LatLng, ring: PolygonPoints): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const straddles = latI > point.lat !== latJ > point.lat;
    if (!straddles) continue;
    const crossLng =
      ((lngJ - lngI) * (point.lat - latI)) / (latJ - latI) + lngI;
    if (point.lng < crossLng) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to a line segment, in km. */
function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const origin = p;
  const pa = project(a, origin);
  const pb = project(b, origin);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineKm(p, a);
  // p projects to the origin (0,0), so the parameter simplifies.
  const t = Math.max(0, Math.min(1, -(pa.x * dx + pa.y * dy) / lenSq));
  const cx = pa.x + t * dx;
  const cy = pa.y + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

export function isInside(shape: FenceShape, point: LatLng): boolean {
  if (shape.kind === "circle") {
    return (
      haversineKm(point, { lat: shape.centerLat, lng: shape.centerLng }) <=
      shape.radiusKm
    );
  }
  return pointInPolygon(point, shape.points);
}

/** Distance to the fence boundary in km, regardless of which side. */
export function distanceToBoundaryKm(shape: FenceShape, point: LatLng): number {
  if (shape.kind === "circle") {
    const d = haversineKm(point, { lat: shape.centerLat, lng: shape.centerLng });
    return Math.abs(shape.radiusKm - d);
  }
  const ring = shape.points;
  if (ring.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = { lat: ring[j][0], lng: ring[j][1] };
    const b = { lat: ring[i][0], lng: ring[i][1] };
    best = Math.min(best, distanceToSegmentKm(point, a, b));
  }
  return best;
}

export function evaluateFence(
  shape: FenceShape,
  approachKm: number,
  point: LatLng,
): FenceReading {
  const inside = isInside(shape, point);
  const distanceKm = distanceToBoundaryKm(shape, point);
  const zone: Zone = !inside
    ? "outside"
    : distanceKm <= approachKm
      ? "approach"
      : "safe";
  return { inside, distanceKm, zone };
}

/**
 * What to announce when the zone changes. Returns null when nothing
 * newsworthy happened, which is the common case ping after ping.
 *
 * A first-ever ping (`previous` null) still reports an approach or a
 * breach — the owner needs to know a car is already over the line.
 */
export function transition(previous: Zone | null, next: Zone): Transition | null {
  if (previous === next) return null;
  if (next === "outside") return "breach";
  if (previous === "outside") return "return";
  if (next === "approach") return "approach";
  return null; // back to safe from approach — no message, just relief
}

/** Parse Geofence.points (stored as JSON) into a validated ring. */
export function parsePolygon(value: unknown): PolygonPoints {
  if (!Array.isArray(value)) return [];
  const ring: PolygonPoints = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const lat = Number(entry[0]);
    const lng = Number(entry[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    ring.push([lat, lng]);
  }
  return ring;
}

/** Build the shape a stored Geofence row describes, or null if incomplete. */
export function shapeFromRow(row: {
  kind: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  points: unknown;
}): FenceShape | null {
  if (row.kind === "polygon") {
    const points = parsePolygon(row.points);
    return points.length >= 3 ? { kind: "polygon", points } : null;
  }
  if (
    row.centerLat == null ||
    row.centerLng == null ||
    row.radiusKm == null ||
    row.radiusKm <= 0
  ) {
    return null;
  }
  return {
    kind: "circle",
    centerLat: row.centerLat,
    centerLng: row.centerLng,
    radiusKm: row.radiusKm,
  };
}
