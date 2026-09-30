import { describe, expect, it } from "vitest";
import {
  distanceToBoundaryKm,
  evaluateFence,
  haversineKm,
  isInside,
  parsePolygon,
  pointInPolygon,
  shapeFromRow,
  stepFence,
  transition,
  type FenceShape,
} from "./fence";
import { FENCE_PRESETS, GEORGIA_ROUGH } from "./presets";

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

describe("stepFence — the zone is stored at every ping", () => {
  const fence: FenceShape = {
    kind: "circle",
    centerLat: TBILISI.lat,
    centerLng: TBILISI.lng,
    radiusKm: 30,
  };
  const edge = { lat: TBILISI.lat + 29.5 / 111.32, lng: TBILISI.lng };

  /** Feed positions through the fence the way the monitor does. */
  const drive = (points: { lat: number; lng: number }[], stored: string | null = null) =>
    points.map((point) => {
      const step = stepFence(stored, undefined, evaluateFence(fence, 1, point).zone);
      stored = step.lastZone;
      return step;
    });

  it("re-arms the approach warning once the car is back in the safe zone", () => {
    const steps = drive([edge, TBILISI, edge]);
    expect(steps.map((step) => step.event)).toEqual(["approach", null, "approach"]);
    // Moving away withdraws the warning still waiting to go out.
    expect(steps[1].relief).toBe("moved_away");
  });

  it("announces a crossing once, and the return as relief", () => {
    const steps = drive([TBILISI, BATUMI, BATUMI, TBILISI]);
    expect(steps.map((step) => step.event)).toEqual([null, "breach", null, "return"]);
    expect(steps[3].relief).toBe("returned");
  });

  /** As `drive`, but with the reading — the way the monitor calls it. */
  const driveHeld = (points: { lat: number; lng: number }[], stored: string | null = null) =>
    points.map((point) => {
      const reading = evaluateFence(fence, 1, point);
      const step = stepFence(stored, undefined, reading.zone, {
        distanceKm: reading.distanceKm,
        approachKm: 1,
      });
      stored = step.lastZone;
      return step;
    });
  /** A point `km` from the line, inside the 30 km circle. */
  const fromLine = (km: number) => ({ lat: TBILISI.lat + (30 - km) / 111.2, lng: TBILISI.lng });

  it("warns once when the car hovers at the edge of the approach band", () => {
    // ±10 m around the 1 km band edge, ping after ping.
    const jitter = [0.99, 1.01, 0.99, 1.01, 0.99, 1.01].map(fromLine);
    const steps = driveHeld(jitter, "safe");
    expect(steps.filter((step) => step.event === "approach")).toHaveLength(1);
    expect(steps.some((step) => step.relief === "moved_away")).toBe(false);
    // Clearly away from the line again: the warning re-arms.
    const away = driveHeld([fromLine(0.9), fromLine(1.5), fromLine(0.9)], "safe");
    expect(away.map((step) => step.event)).toEqual(["approach", null, "approach"]);
    expect(away[1].relief).toBe("moved_away");
  });

  it("reports one crossing when the car hovers right on the line", () => {
    const onLine = [0.005, -0.005, 0.005, -0.005, 0.005].map(fromLine);
    const steps = driveHeld(onLine, "approach");
    expect(steps.map((step) => step.event)).toEqual([null, "breach", null, null, null]);
    // Back well inside counts as the return.
    expect(driveHeld([fromLine(0.3)], "outside")[0]).toMatchObject({
      event: "return",
      relief: "returned",
    });
  });

  it("falls back to the last event for a fence saved before zones were stored", () => {
    expect(stepFence(null, "breach", "safe")).toMatchObject({ event: "return", lastZone: "safe" });
    expect(stepFence(null, "approach", "approach").event).toBeNull();
    // Once stored, the stored zone wins over an old event.
    expect(stepFence("safe", "approach", "approach").event).toBe("approach");
  });
});

describe("red-line presets", () => {
  const georgia: FenceShape = { kind: "polygon", points: GEORGIA_ROUGH };
  const inside = {
    Tbilisi: TBILISI,
    Batumi: BATUMI,
    Sarpi: { lat: 41.52, lng: 41.55 },
    Kutaisi: { lat: 42.2679, lng: 42.6946 },
    Zugdidi: { lat: 42.51, lng: 41.87 },
    Mestia: { lat: 43.05, lng: 42.73 },
    Stepantsminda: { lat: 42.66, lng: 44.64 },
    Lagodekhi: { lat: 41.83, lng: 46.28 },
    Dedoplistskaro: { lat: 41.46, lng: 46.1 },
    Sadakhlo: { lat: 41.25, lng: 44.8 },
    Ninotsminda: { lat: 41.26, lng: 43.59 },
    Akhaltsikhe: { lat: 41.64, lng: 42.98 },
    Khulo: { lat: 41.64, lng: 42.31 },
    Sukhumi: { lat: 43.0, lng: 41.02 },
  };
  const outside = {
    Yerevan: { lat: 40.18, lng: 44.51 },
    Gyumri: { lat: 40.79, lng: 43.85 },
    Kars: { lat: 40.6, lng: 43.1 },
    Trabzon: { lat: 41.0, lng: 39.72 },
    Hopa: { lat: 41.39, lng: 41.42 },
    Posof: { lat: 41.51, lng: 42.73 },
    Vladikavkaz: { lat: 43.02, lng: 44.68 },
    Sochi: { lat: 43.6, lng: 39.73 },
    Qazax: { lat: 41.09, lng: 45.37 },
    Ganja: { lat: 40.68, lng: 46.36 },
    Zaqatala: { lat: 41.63, lng: 46.64 },
  };

  it("the rough Georgia polygon holds Georgian towns and leaves the neighbours out", () => {
    for (const [name, point] of Object.entries(inside)) {
      expect([name, isInside(georgia, point)]).toEqual([name, true]);
    }
    for (const [name, point] of Object.entries(outside)) {
      expect([name, isInside(georgia, point)]).toEqual([name, false]);
    }
  });

  it("every preset is a valid shape", () => {
    for (const preset of FENCE_PRESETS) {
      const shape = shapeFromRow({
        kind: preset.kind,
        centerLat: preset.kind === "circle" ? preset.centerLat : null,
        centerLng: preset.kind === "circle" ? preset.centerLng : null,
        radiusKm: preset.kind === "circle" ? preset.radiusKm : null,
        points: preset.kind === "polygon" ? preset.points : null,
      });
      expect(shape).not.toBeNull();
    }
  });
});
