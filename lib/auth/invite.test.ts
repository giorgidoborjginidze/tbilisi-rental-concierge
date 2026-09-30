import { describe, expect, it } from "vitest";
import { INVITE_DAYS, inviteProblem, inviteUsable } from "./invite";

const now = new Date("2026-09-30T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const invite = (over: Partial<{ email: string; usedAt: Date | null; createdAt: Date }> = {}) => ({
  email: "Nino@Example.com",
  usedAt: null,
  createdAt: daysAgo(1),
  ...over,
});

describe("team invites", () => {
  it("works for the invited email, in any letter case", () => {
    expect(inviteProblem(invite(), "nino@example.com", now)).toBeNull();
  });

  it("refuses any other email — a forwarded link gives no seat", () => {
    expect(inviteProblem(invite(), "someone@else.ge", now)).toBe("error_invite_email");
  });

  it("refuses a used, expired or unknown invite", () => {
    expect(inviteProblem(invite({ usedAt: daysAgo(0.5) }), "nino@example.com", now)).toBe("error_invite_invalid");
    expect(inviteProblem(invite({ createdAt: daysAgo(INVITE_DAYS + 0.01) }), "nino@example.com", now)).toBe(
      "error_invite_invalid",
    );
    expect(inviteProblem(null, "nino@example.com", now)).toBe("error_invite_invalid");
    expect(inviteUsable(invite({ createdAt: daysAgo(INVITE_DAYS - 0.01) }), now)).toBe(true);
  });
});
