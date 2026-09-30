import { describe, expect, it } from "vitest";
import {
  checkFixTime,
  fieldsFromJson,
  fieldsFromParams,
  parseFixTime,
  parsePing,
  pingCredentials,
  tokensMatch,
} from "./ping";

const query = (qs: string) => fieldsFromParams(new URLSearchParams(qs));
const auth = "deviceId=TLT-1&token=secret";

describe("parsePing — only one real fix is accepted", () => {
  it("reads a plain position", () => {
    const parsed = parsePing(query(`${auth}&lat=41.64&lon=41.63&speed=54`));
    expect(parsed).toEqual({
      ok: true,
      ping: { deviceId: "TLT-1", token: "secret", lat: 41.64, lng: 41.63, speed: 54, at: null },
    });
  });

  it("refuses a position appended to an address that already carries one", () => {
    // The old copied address had the sample Tbilisi position baked in; a
    // gateway appending the real Batumi position must not read as Tbilisi.
    const copied = `${auth}&lat=41.7151&lng=44.8271`;
    expect(parsePing(query(`${copied}&lat=41.6410&lon=41.6330`))).toEqual({
      ok: false,
      error: "duplicate_position",
    });
    expect(parsePing(query(`${auth}&lat=41.64&lat=41.65&lng=41.63`))).toEqual({
      ok: false,
      error: "duplicate_position",
    });
    // Even the same value twice, or lng and lon together: one position only.
    expect(parsePing(query(`${auth}&lat=41.64&lat=41.64&lng=41.63`))).toEqual({
      ok: false,
      error: "duplicate_position",
    });
    expect(parsePing(query(`${auth}&lat=41.64&lng=41.63&lon=41.63`))).toEqual({
      ok: false,
      error: "duplicate_position",
    });
  });

  it("refuses the example position itself", () => {
    expect(parsePing(query(`${auth}&lat=41.7151&lng=44.8271`))).toEqual({
      ok: false,
      error: "example_position",
    });
  });

  it("refuses an empty position instead of reading it as 0,0", () => {
    expect(parsePing(query(`${auth}&lat=&lng=`))).toEqual({
      ok: false,
      error: "invalid_position",
    });
    expect(parsePing(query(`${auth}&lng=44.8`))).toEqual({
      ok: false,
      error: "invalid_position",
    });
    expect(parsePing(query(`${auth}&lat=abc&lng=44.8`))).toEqual({
      ok: false,
      error: "invalid_position",
    });
    expect(parsePing(query(`${auth}&lat=95&lng=44.8`))).toEqual({
      ok: false,
      error: "invalid_position",
    });
  });

  it("refuses a no-fix report (0,0 or valid=false)", () => {
    expect(parsePing(query(`${auth}&lat=0&lng=0`))).toEqual({ ok: false, error: "no_fix" });
    expect(parsePing(query(`${auth}&lat=0.0&lng=0.000`))).toEqual({
      ok: false,
      error: "no_fix",
    });
    expect(parsePing(query(`${auth}&lat=41.64&lng=41.63&valid=false`))).toEqual({
      ok: false,
      error: "no_fix",
    });
    expect(
      parsePing(fieldsFromJson({ deviceId: "TLT-1", token: "secret", lat: 0, lng: 0 })),
    ).toEqual({ ok: false, error: "no_fix" });
  });

  it("wants credentials, preferably from a header", () => {
    expect(parsePing(query("lat=41.64&lng=41.63&id=TLT-1"))).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(pingCredentials(query("id=TLT-1&lat=1&lng=1"), "from-header")).toEqual({
      deviceId: "TLT-1",
      token: "from-header",
    });
  });

  it("reads JSON bodies, including a nested location", () => {
    const parsed = parsePing(
      fieldsFromJson({
        device_id: "TLT-1",
        location: {
          timestamp: "2026-09-30T10:00:00Z",
          coords: { latitude: 41.64, longitude: 41.63, speed: 10 },
        },
      }),
      "secret",
    );
    expect(parsed.ok && parsed.ping).toMatchObject({
      deviceId: "TLT-1",
      lat: 41.64,
      lng: 41.63,
      at: new Date("2026-09-30T10:00:00Z"),
    });
  });

  it("reads Unix timestamps in seconds and milliseconds", () => {
    expect(parseFixTime("1790762400")).toEqual(new Date(1790762400 * 1000));
    expect(parseFixTime("1790762400000")).toEqual(new Date(1790762400000));
    expect(parseFixTime("nonsense")).toBeNull();
    expect(parsePing(query(`${auth}&lat=41.64&lng=41.63&at=nonsense`))).toEqual({
      ok: false,
      error: "invalid_timestamp",
    });
  });
});

describe("checkFixTime", () => {
  const now = new Date("2026-09-30T10:00:00Z");
  const last = new Date("2026-09-30T09:59:00Z");

  it("accepts a newer fix, and a small clock drift ahead", () => {
    expect(checkFixTime(new Date("2026-09-30T09:59:30Z"), last, now)).toBeNull();
    expect(checkFixTime(new Date("2026-09-30T10:04:00Z"), last, now)).toBeNull();
    expect(checkFixTime(now, null, now)).toBeNull();
  });

  it("refuses a fix from the future", () => {
    expect(checkFixTime(new Date("2026-09-30T10:06:00Z"), last, now)).toBe("future_timestamp");
  });

  it("refuses a buffered fix no newer than the last one", () => {
    expect(checkFixTime(new Date("2026-09-30T09:58:00Z"), last, now)).toBe("stale_ping");
    expect(checkFixTime(last, last, now)).toBe("stale_ping");
  });
});

describe("tokensMatch", () => {
  it("compares whole tokens, whatever their length", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
    expect(tokensMatch("abc", "abd")).toBe(false);
    expect(tokensMatch("abc", "abcd")).toBe(false);
    expect(tokensMatch("abc", "")).toBe(false);
  });
});
