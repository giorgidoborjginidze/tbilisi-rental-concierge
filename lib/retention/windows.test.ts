import { afterEach, describe, expect, it } from "vitest";
import { cutoff, retentionWindows } from "./windows";

const ENV_KEYS = [
  "RETENTION_GEO_EVENT_DAYS",
  "RETENTION_NOTIFY_MESSAGE_DAYS",
  "RETENTION_AUDIT_LOG_DAYS",
  "RETENTION_LOGIN_ATTEMPT_DAYS",
  "RETENTION_CLOSED_ALERT_DAYS",
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("cutoff", () => {
  it("moves back exactly n days", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    expect(cutoff(now, 90).toISOString()).toBe("2026-06-12T12:00:00.000Z");
  });

  it("leaves `now` alone at zero days", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    expect(cutoff(now, 0).getTime()).toBe(now.getTime());
  });
});

describe("retentionWindows", () => {
  it("uses the documented defaults when nothing is set", () => {
    expect(retentionWindows()).toEqual({
      geoEventDays: 90,
      notifyMessageDays: 180,
      auditLogDays: 730,
      loginAttemptDays: 30,
      closedAlertDays: 365,
    });
  });

  it("takes an override from the environment", () => {
    process.env.RETENTION_GEO_EVENT_DAYS = "30";
    expect(retentionWindows().geoEventDays).toBe(30);
  });

  it("falls back rather than accepting a nonsense window", () => {
    // An empty, zero or negative value would mean "delete everything" or
    // "keep forever" — both worse than the documented default.
    for (const bad of ["", "0", "-5", "abc"]) {
      process.env.RETENTION_GEO_EVENT_DAYS = bad;
      expect(retentionWindows().geoEventDays, bad).toBe(90);
    }
  });
});
