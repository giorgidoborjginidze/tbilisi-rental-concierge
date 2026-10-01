import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openSecret, sealSecret, secretsConfigured } from "./secret";

const env = { SECRETS_KEY: randomBytes(32).toString("base64") };
const other = { SECRETS_KEY: randomBytes(32).toString("base64") };

describe("sealed secrets", () => {
  it("round-trips and never stores the plain text", () => {
    const sealed = sealSecret("EAAG-token-123", env)!;
    expect(sealed).not.toContain("EAAG");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(openSecret(sealed, env)).toBe("EAAG-token-123");
    expect(sealSecret("x", env)).not.toBe(sealSecret("x", env));
  });

  it("refuses another key, tampering and a missing key", () => {
    const sealed = sealSecret("secret", env)!;
    expect(openSecret(sealed, other)).toBeNull();
    expect(openSecret(sealed.slice(0, -2) + "AA", env)).toBeNull();
    expect(openSecret(sealed, {})).toBeNull();
    expect(sealSecret("secret", { SECRETS_KEY: "short" })).toBeNull();
    expect(secretsConfigured({})).toBe(false);
  });
});
