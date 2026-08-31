import { describe, expect, it } from "vitest";
import {
  distanceToBoundaryKm,
  evaluateFence,
  haversineKm,
  isInside,
  parsePolygon,
  pointInPolygon,
  shapeFromRow,
  transition,
  type FenceShape,
} from "./fence";

const TBILISI = { lat: 41.7151, lng: 44.8271 };
const RUSTAVI = { lat: 41.5495, lng: 45.0 };
const BATUMI = { lat: 41.6168, lng: 41.6367 };

describe("haversineKm", () => {
  it("measures real distances between Georgian cities", () => {
    // Tbilisi → Batumi is roughly 265 km as the crow flies.
    expect(haversineKm(TBILISI, BATUMI)).toBeGreaterThan(255);
    expect(haversineKm(TBILISI, BATUMI)).toBeLessThan(275);
    expect(haversineKm(TBILISI, TBILISI)).toBe(0);
  });
});

describe("circle fences", () => {
  const fence: FenceShape = {
    kind: "circle",
    centerLat: TBILISI.lat,
    centerLng: TBILISI.lng,
    radiusKm: 30,
  };

  it("puts the city inside and the coast outside", () => {
    expect(isInside(fence, TBILISI)).toBe(true);
    expect(isInside(fence, RUSTAVI)).toBe(true);
    expect(isInside(fence, BATUMI)).toBe(false);
  });

  it("measures the distance to the boundary from either side", () => {
    expect(distanceToBoundaryKm(fence, TBILISI)).toBeCloseTo(30, 5);
    // Batumi is ~265 km out, so ~235 km past a 30 km boundary.
    expect(distanceToBoundaryKm(fence, BATUMI)).toBeGreaterThan(220);
  });

  it("warns one kilometre before the line", () => {
    // ~0.9 km short of the 30 km radius, due north of the centre.
    const nearEdge = { lat: TBILISI.lat + 29.1 / 111.32, lng: TBILISI.lng };
    expect(evaluateFence(fence, 1, nearEdge).zone).toBe("approach");
    expect(evaluateFence(fence, 1, TBILISI).zone).toBe("safe");
    expect(evaluateFence(fence, 1, BATUMI).zone).toBe("outside");
  });
});

describe("polygon fences", () => {
  // A square roughly around central Tbilisi.
  const square: FenceShape = {
    kind: "polygon",
    points: [
      [41.6, 44.7],
      [41.6, 45.0],
      [41.85, 45.0],
      [41.85, 44.7],
    ],
  };

  it("decides inside and outside by ray casting", () => {
    expect(pointInPolygon(TBILISI, square.kind === "polygon" ? square.points : [])).toBe(true);
    expect(isInside(square, TBILISI)).toBe(true);
    expect(isInside(square, BATUMI)).toBe(false);
  });

  it("measures the distance to the nearest edge", () => {
    // Just under the southern edge at 41.60.
    const belowEdge = { lat: 41.59, lng: 44.85 };
    expect(distanceToBoundaryKm(square, belowEdge)).toBeLessThan(1.5);
    expect(evaluateFence(square, 1, belowEdge).inside).toBe(false);
  });

  it("rejects a ring with fewer than three points", () => {
    expect(pointInPolygon(TBILISI, [[41.6, 44.7], [41.8, 45.0]])).toBe(false);
  });
});

describe("transition", () => {
  it("announces the approach, the breach and the return once each", () => {
    expect(transition("safe", "approach")).toBe("approach");
    expect(transition("approach", "outside")).toBe("breach");
    expect(transition("safe", "outside")).toBe("breach");
    expect(transition("outside", "approach")).toBe("return");
    expect(transition("outside", "safe")).toBe("return");
  });

  it("stays silent while nothing changes", () => {
    expect(transition("outside", "outside")).toBeNull();
    expect(transition("approach", "approach")).toBeNull();
    // Drifting back from the edge is good news, not an alert.
    expect(transition("approach", "safe")).toBeNull();
  });

  it("still reports a first ping that is already over the line", () => {
    expect(transition(null, "outside")).toBe("breach");
    expect(transition(null, "approach")).toBe("approach");
    expect(transition(null, "safe")).toBeNull();
  });
});

describe("parsing stored fences", () => {
  it("drops malformed polygon points", () => {
    expect(
      parsePolygon([[41.7, 44.8], ["x", 1], [200, 44], [41.8, 44.9], null]),
    ).toEqual([
      [41.7, 44.8],
      [41.8, 44.9],
    ]);
    expect(parsePolygon("nope")).toEqual([]);
  });

  it("returns null for an incomplete row rather than a broken shape", () => {
    expect(
      shapeFromRow({ kind: "circle", centerLat: 41.7, centerLng: null, radiusKm: 10, points: null }),
    ).toBeNull();
    expect(
      shapeFromRow({ kind: "circle", centerLat: 41.7, centerLng: 44.8, radiusKm: 0, points: null }),
    ).toBeNull();
    expect(
      shapeFromRow({ kind: "polygon", centerLat: null, centerLng: null, radiusKm: null, points: [[41.7, 44.8]] }),
    ).toBeNull();
    expect(
      shapeFromRow({ kind: "circle", centerLat: 41.7, centerLng: 44.8, radiusKm: 30, points: null }),
    ).toEqual({ kind: "circle", centerLat: 41.7, centerLng: 44.8, radiusKm: 30 });
  });
});
