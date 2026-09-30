// Ready-made red lines, so an owner who does not know coordinates can set
// one with a tap, and the sample position shown next to the ping address.
//
// Pure and client-safe.

import type { PolygonPoints } from "./fence";

export type FencePreset =
  | {
      id: string;
      kind: "circle";
      centerLat: number;
      centerLng: number;
      radiusKm: number;
    }
  | { id: string; kind: "polygon"; points: PolygonPoints };

const TBILISI = { centerLat: 41.7151, centerLng: 44.8271 };
const BATUMI = { centerLat: 41.6168, centerLng: 41.6367 };
const KUTAISI = { centerLat: 42.2679, centerLng: 42.6946 };

/**
 * Georgia's borders, roughly — a couple of dozen points drawn a little
 * outside the real line, so no Georgian town reads as "over the line".
 * Near a border it can be off by a few kilometres either way.
 */
export const GEORGIA_ROUGH: PolygonPoints = [
  [41.5, 41.5], // Sarpi, sea side
  [41.9, 41.4],
  [42.4, 41.3],
  [42.95, 40.85],
  [43.38, 39.95], // Psou mouth
  [43.6, 40.1],
  [43.5, 41.2],
  [43.25, 42.3],
  [43.0, 43.4],
  [42.7, 44.0],
  [42.73, 44.65], // Larsi
  [42.7, 45.2],
  [42.5, 45.8],
  [41.9, 46.33], // Lagodekhi
  [41.6, 46.5],
  [41.25, 46.75],
  [41.05, 46.5],
  [41.25, 45.6],
  [41.3, 45.05], // Red Bridge
  [41.18, 44.5],
  [41.1, 43.8],
  [41.05, 43.4],
  [41.57, 42.85], // Vale
  [41.5, 42.5],
  [41.48, 41.8],
];

export const FENCE_PRESETS: FencePreset[] = [
  { id: "tbilisi30", kind: "circle", ...TBILISI, radiusKm: 30 },
  { id: "tbilisi50", kind: "circle", ...TBILISI, radiusKm: 50 },
  { id: "batumi20", kind: "circle", ...BATUMI, radiusKm: 20 },
  { id: "kutaisi20", kind: "circle", ...KUTAISI, radiusKm: 20 },
  { id: "georgia", kind: "polygon", points: GEORGIA_ROUGH },
];

/**
 * The position used in the example ping line. It is an example only: the
 * ping endpoint refuses exactly this position, so a copied example can
 * never pin a car to central Tbilisi.
 */
export const EXAMPLE_POSITION = { lat: 41.7151, lng: 44.8271 };
