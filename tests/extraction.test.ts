import { describe, expect, it } from "vitest";
import { stubExtractCriteria } from "@/lib/ai/stub";
import { parseCriteria } from "@/lib/criteria";

const NOW = new Date("2026-07-15T12:00:00Z");

describe("stub criteria extraction (no-API-key fallback)", () => {
  it("parses the canonical example query", () => {
    const c = stubExtractCriteria(
      "2-bedroom furnished flat in Vera or Vake, under $800/month, pet-friendly, available from September.",
      NOW,
    );
    expect(c.type).toBe("rent");
    expect(c.minBedrooms).toBe(2);
    expect(c.furnished).toBe(true);
    expect(c.petsAllowed).toBe(true);
    expect(c.maxPrice).toBe(800);
    expect(c.districts).toEqual(expect.arrayContaining(["Vera", "Vake"]));
    expect(c.propertyTypes).toContain("apartment");
    expect(c.availableFrom).toBe("2026-09-01");
  });

  it("maps Old Town to Sololaki", () => {
    const c = stubExtractCriteria("apartment in Old Town under 1200", NOW);
    expect(c.districts).toContain("Sololaki");
    expect(c.maxPrice).toBe(1200);
  });

  it("understands a Georgian query", () => {
    const c = stubExtractCriteria(
      "ორ საძინებლიანი ავეჯით ბინა ვაკეში, თვეში $700-მდე, ცხოველებით",
      NOW,
    );
    expect(c.minBedrooms).toBe(2);
    expect(c.furnished).toBe(true);
    expect(c.petsAllowed).toBe(true);
    expect(c.maxPrice).toBe(700);
    expect(c.districts).toContain("Vake");
  });

  it("detects unfurnished and no-pets negations", () => {
    const c = stubExtractCriteria(
      "unfurnished studio in Saburtalo, no pets, under $500",
      NOW,
    );
    expect(c.furnished).toBe(false);
    expect(c.petsAllowed).toBe(false);
    expect(c.propertyTypes).toContain("studio");
  });

  it("rolls 'from September' into next year when September has passed", () => {
    const december = new Date("2026-12-01T00:00:00Z");
    const c = stubExtractCriteria("flat available from September", december);
    expect(c.availableFrom).toBe("2027-09-01");
  });

  it("always yields validated criteria", () => {
    const c = stubExtractCriteria("something entirely unrelated to housing", NOW);
    const parsed = parseCriteria(c);
    expect(parsed.success).toBe(true);
    expect(c.type).toBe("rent");
  });
});

describe("criteria validation", () => {
  it("accepts a minimal valid object and applies defaults", () => {
    const parsed = parseCriteria({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("rent");
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("rejects unknown districts", () => {
    const parsed = parseCriteria({ districts: ["Atlantis"] });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown extra fields (strict schema)", () => {
    const parsed = parseCriteria({ hackField: true });
    expect(parsed.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    const parsed = parseCriteria({ availableFrom: "September 2026" });
    expect(parsed.success).toBe(false);
  });
});
