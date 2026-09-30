import { describe, expect, it } from "vitest";
import { cronAuthorized } from "./auth";

const secret = "s3cret-value-long-enough-for-cron";

describe("the cron route's guard", () => {
  it("lets in only the bearer of CRON_SECRET", () => {
    expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe("ok");
    expect(cronAuthorized(`bearer ${secret}`, secret)).toBe("ok");
    expect(cronAuthorized(`Bearer ${secret}x`, secret)).toBe("unauthorized");
    expect(cronAuthorized(secret, secret)).toBe("unauthorized");
    expect(cronAuthorized(null, secret)).toBe("unauthorized");
  });

  it("is closed to everyone while the secret is missing or too short", () => {
    expect(cronAuthorized("Bearer ", "")).toBe("not_configured");
    expect(cronAuthorized("Bearer x", undefined)).toBe("not_configured");
    expect(cronAuthorized("Bearer short", "short")).toBe("not_configured");
  });
});
