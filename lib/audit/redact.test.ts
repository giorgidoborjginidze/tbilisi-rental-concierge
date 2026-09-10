import { describe, expect, it } from "vitest";
import { subjectRef, truncateIp } from "./redact";

describe("subjectRef", () => {
  it("is stable and case/space insensitive", () => {
    expect(subjectRef("ops@kolkhetistays.ge")).toBe(
      subjectRef("  OPS@KolkhetiStays.GE "),
    );
  });

  it("separates different people", () => {
    expect(subjectRef("a@example.com")).not.toBe(subjectRef("b@example.com"));
  });

  it("does not carry the address itself", () => {
    const ref = subjectRef("ops@kolkhetistays.ge");
    expect(ref).toHaveLength(16);
    expect(ref).not.toContain("@");
    expect(/^[0-9a-f]{16}$/.test(ref)).toBe(true);
  });
});

describe("truncateIp", () => {
  it("keeps three octets of an IPv4 address", () => {
    expect(truncateIp("212.72.155.31")).toBe("212.72.155.0/24");
  });

  it("takes the client from an x-forwarded-for chain", () => {
    expect(truncateIp("212.72.155.31, 10.0.0.1, 10.0.0.2")).toBe(
      "212.72.155.0/24",
    );
  });

  it("keeps three groups of an IPv6 address", () => {
    expect(truncateIp("2a00:1450:4001:80e::200e")).toBe("2a00:1450:4001::/48");
  });

  it("drops what it cannot parse rather than guessing", () => {
    expect(truncateIp("unknown")).toBe(null);
    expect(truncateIp("999.1.1.1")).toBe(null);
    expect(truncateIp(null)).toBe(null);
    expect(truncateIp("")).toBe(null);
  });
});
