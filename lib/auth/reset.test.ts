import { describe, expect, it } from "vitest";
import { newResetToken, plausibleResetToken, RESET_TTL_MS, resetTokenId, resetUsable, validEmail } from "./reset";

describe("password-reset tokens", () => {
  it("stores only a hash of the token, never the token itself", () => {
    const { token, id } = newResetToken();
    expect(id).toBe(resetTokenId(token));
    expect(id).not.toContain(token);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(plausibleResetToken(token)).toBe(true);
    expect(newResetToken().token).not.toBe(token);
  });

  it("works once, and only within the hour", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const fresh = { expiresAt: new Date(now.getTime() + RESET_TTL_MS), usedAt: null };
    expect(resetUsable(fresh, now)).toBe(true);
    expect(resetUsable({ ...fresh, usedAt: now }, now)).toBe(false);
    expect(resetUsable({ ...fresh, expiresAt: now }, now)).toBe(false);
    expect(resetUsable(null, now)).toBe(false);
  });

  it("rejects malformed tokens before any lookup", () => {
    expect(plausibleResetToken("../../etc")).toBe(false);
    expect(plausibleResetToken("")).toBe(false);
  });
});

describe("validEmail", () => {
  it("accepts ordinary addresses and refuses obvious junk", () => {
    expect(validEmail("nino@activo.world")).toBe(true);
    expect(validEmail("nino@activo")).toBe(false);
    expect(validEmail("nino activo@x.ge")).toBe(false);
    expect(validEmail(`${"a".repeat(250)}@x.ge`)).toBe(false);
  });
});
