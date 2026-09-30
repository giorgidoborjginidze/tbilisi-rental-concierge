import { describe, it, expect } from "vitest";
import {
  callbackOutcome,
  flittConfig,
  flittSignature,
  isFlittSandbox,
  isProductionDeploy,
  verifyFlittCallback,
} from "./flitt";

describe("flittSignature", () => {
  it("is stable regardless of key insertion order", () => {
    const a = flittSignature({ b: "2", a: "1", c: "3" }, "secret");
    const b = flittSignature({ c: "3", a: "1", b: "2" }, "secret");
    expect(a).toBe(b);
  });

  it("ignores the signature field and empty values", () => {
    const withNoise = flittSignature(
      { a: "1", b: "2", signature: "zzz", empty: "" },
      "secret",
    );
    const clean = flittSignature({ a: "1", b: "2" }, "secret");
    expect(withNoise).toBe(clean);
  });

  it("changes when the secret changes", () => {
    const one = flittSignature({ a: "1" }, "secret-one");
    const two = flittSignature({ a: "1" }, "secret-two");
    expect(one).not.toBe(two);
  });

  it("produces a 40-char hex sha1 digest", () => {
    expect(flittSignature({ a: "1" }, "s")).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("verifyFlittCallback", () => {
  const cfg = {
    merchantId: "1396424",
    secretKey: "test",
    currency: "USD",
    apiUrl: "https://example.com",
  };

  it("accepts a correctly signed callback and extracts fields", () => {
    const fields: Record<string, string> = {
      order_id: "activo-1",
      order_status: "approved",
      amount: "4900",
      currency: "USD",
      payment_id: "999",
    };
    fields.signature = flittSignature(fields, cfg.secretKey);

    const result = verifyFlittCallback(fields, cfg);
    expect(result.valid).toBe(true);
    expect(result.orderId).toBe("activo-1");
    expect(result.status).toBe("approved");
    expect(result.amountMinor).toBe(4900);
    expect(result.providerRef).toBe("999");
  });

  it("rejects a tampered amount", () => {
    const fields: Record<string, string> = {
      order_id: "activo-1",
      order_status: "approved",
      amount: "4900",
    };
    fields.signature = flittSignature(fields, cfg.secretKey);
    fields.amount = "1"; // tamper after signing

    expect(verifyFlittCallback(fields, cfg).valid).toBe(false);
  });

  it("rejects a missing signature", () => {
    const result = verifyFlittCallback(
      { order_id: "x", order_status: "approved" },
      cfg,
    );
    expect(result.valid).toBe(false);
  });
});

describe("flittConfig", () => {
  it("uses the public sandbox locally when no keys are set", () => {
    const cfg = flittConfig({ NODE_ENV: "development" });
    expect(cfg?.merchantId).toBe("1396424");
    expect(isFlittSandbox(cfg)).toBe(true);
  });

  it("fails closed on a production deployment without keys", () => {
    expect(flittConfig({ VERCEL_ENV: "production", NODE_ENV: "production", VERCEL: "1" })).toBeNull();
    expect(flittConfig({ NODE_ENV: "production", VERCEL: "1" })).toBeNull();
    expect(isProductionDeploy({ NODE_ENV: "production", VERCEL: "1" })).toBe(true);
    expect(isProductionDeploy({ NODE_ENV: "production" })).toBe(false);
  });

  it("never lets FLITT_SANDBOX switch production to the test merchant", () => {
    expect(flittConfig({ VERCEL_ENV: "production", VERCEL: "1", FLITT_SANDBOX: "1" })).toBeNull();
    expect(flittConfig({ VERCEL_ENV: "preview", NODE_ENV: "production", VERCEL: "1", FLITT_SANDBOX: "1" })?.merchantId).toBe("1396424");
  });

  it("uses the real merchant in production, in GEL on pay.flitt.com", () => {
    const cfg = flittConfig({ VERCEL_ENV: "production", FLITT_MERCHANT_ID: "555", FLITT_SECRET_KEY: "s3cret" });
    expect(cfg).toEqual({ merchantId: "555", secretKey: "s3cret", currency: "GEL", apiUrl: "https://pay.flitt.com/api/checkout/url/" });
  });

  it("never pairs a real merchant id with a missing secret", () => {
    expect(flittConfig({ FLITT_MERCHANT_ID: "555" })).toBeNull();
    expect(flittConfig({ FLITT_SECRET_KEY: "s3cret" })).toBeNull();
  });
});

describe("callbackOutcome", () => {
  it("activates only an approved order with the exact amount", () => {
    expect(callbackOutcome("approved", true)).toBe("approved");
    expect(callbackOutcome("approved", false)).toBe("declined");
  });

  it("records final refusals as declined and keeps intermediate states waiting", () => {
    expect(callbackOutcome("declined", true)).toBe("declined");
    expect(callbackOutcome("expired", true)).toBe("declined");
    expect(callbackOutcome("processing", true)).toBe("pending");
    expect(callbackOutcome("created", true)).toBe("pending");
    expect(callbackOutcome(null, true)).toBe("pending");
  });
});
