import { describe, expect, it } from "vitest";
import { normalizePhone, waLink } from "./phone";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
  TEMPLATE_ROLE,
  defaultTemplate,
  render,
} from "./templates";

describe("templates", () => {
  it("defines every key in both languages, with a role", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(DEFAULT_TEMPLATES.ka[key], key).toBeTruthy();
      expect(DEFAULT_TEMPLATES.en[key], key).toBeTruthy();
      expect(TEMPLATE_ROLE[key], key).toMatch(/^(driver|owner)$/);
    }
  });

  it("keeps the geofence wording about a right, never a claim", () => {
    // Activo cannot contact 112 itself; the driver-facing warning must
    // describe the owner's contractual right, not a completed report.
    expect(DEFAULT_TEMPLATES.ka.geo_approach_driver).toContain("უფლება აქვს");
    expect(DEFAULT_TEMPLATES.ka.geo_breach_driver).toContain("შესაძლოა");
  });

  it("addresses the owner's messages with the plate", () => {
    expect(defaultTemplate("ka", "geo_approach_owner")).toContain("{plate}");
    expect(defaultTemplate("ka", "geo_breach_owner")).toContain("{plate}");
  });
});

describe("render", () => {
  it("substitutes the placeholders it is given", () => {
    expect(render("ნომერი {plate} გადავიდა", { plate: "AA-123-BB" })).toBe(
      "ნომერი AA-123-BB გადავიდა",
    );
  });

  it("leaves an unknown or empty placeholder visible instead of blanking it", () => {
    expect(render("{plate} / {mystery}", { plate: "" })).toBe("{plate} / {mystery}");
  });
});

describe("normalizePhone", () => {
  it("keeps international numbers and adds 995 to Georgian mobiles", () => {
    expect(normalizePhone("+995 599 12 34 56")).toBe("995599123456");
    expect(normalizePhone("599 12 34 56")).toBe("995599123456");
    expect(normalizePhone("00995599123456")).toBe("995599123456");
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");
  });

  it("rejects anything too short to dial", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("waLink", () => {
  it("builds a click-to-send link with the text encoded", () => {
    expect(waLink("995599123456", "hello world")).toBe(
      "https://wa.me/995599123456?text=hello%20world",
    );
    expect(waLink(null, "hi")).toBe("https://wa.me/?text=hi");
  });
});
