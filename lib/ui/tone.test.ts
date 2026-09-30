import { describe, expect, it } from "vitest";
import {
  alertCardClass,
  alertSeverity,
  badgeClass,
  OUTBOX_TONE,
  PAYMENT_TONE,
  toneOf,
  VERDICT_BADGE,
  ZONE_TONE,
} from "./tone";

describe("one colour meaning", () => {
  it("green means fine, amber attention, red danger — for payments, zones and messages alike", () => {
    expect(PAYMENT_TONE.ok).toBe("good");
    expect(ZONE_TONE.safe).toBe("good");
    expect(OUTBOX_TONE.sent).toBe("good");
    expect(PAYMENT_TONE.grace).toBe("warn");
    expect(ZONE_TONE.approach).toBe("warn");
    expect(PAYMENT_TONE.repossess).toBe("danger");
    expect(ZONE_TONE.outside).toBe("danger");
    expect(OUTBOX_TONE.failed).toBe("danger");
  });

  it("violet is never used for a state", () => {
    for (const map of [PAYMENT_TONE, ZONE_TONE, OUTBOX_TONE]) {
      expect(Object.values(map)).not.toContain("listed");
    }
  });

  it("calculators share one verdict palette", () => {
    expect(VERDICT_BADGE).toEqual({
      good: "badge badge--good",
      ok: "badge badge--warn",
      poor: "badge badge--danger",
    });
  });

  it("the costly alerts are red, the time-bound amber, the rest blue", () => {
    expect(alertSeverity("overlap")).toBe("danger");
    expect(alertSeverity("repossession_right")).toBe("danger");
    expect(alertSeverity("geofence_breach")).toBe("danger");
    expect(alertSeverity("rent_overdue")).toBe("warn");
    expect(alertSeverity("vacancy_gap")).toBe("info");
    expect(alertSeverity("something_new")).toBe("info");
    expect(alertCardClass("danger")).toBe("alert-card alert-card--danger");
  });

  it("unknown keys fall back to grey", () => {
    expect(toneOf(ZONE_TONE, "nowhere")).toBe("muted");
    expect(toneOf(ZONE_TONE, null)).toBe("muted");
    expect(badgeClass(toneOf(OUTBOX_TONE, "sent"))).toBe("badge badge--good");
  });
});
