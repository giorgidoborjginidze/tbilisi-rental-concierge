import { describe, expect, it } from "vitest";
import { normalizePhone, waLink } from "./phone";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
  TEMPLATE_ROLE,
  defaultTemplate,
  MISSING,
  render,
  isFixedTemplate,
  mentionsPolice,
  optOutLine,
} from "./templates";
import { baseVars, messageDate } from "./vars";

describe("templates", () => {
  it("defines every key in both languages, with a role", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(DEFAULT_TEMPLATES.ka[key], key).toBeTruthy();
      expect(DEFAULT_TEMPLATES.en[key], key).toBeTruthy();
      expect(TEMPLATE_ROLE[key], key).toMatch(/^(driver|tenant|owner)$/);
    }
  });

  it("keeps the geofence wording about a right, never a claim", () => {
    // Activo cannot contact 112 itself; the driver-facing warning must
    // describe the owner's contractual right, not a completed report.
    expect(DEFAULT_TEMPLATES.ka.geo_approach_driver).toContain("უფლება აქვს");
    expect(DEFAULT_TEMPLATES.ka.geo_breach_driver).toContain("უფლება აქვს");
    expect(DEFAULT_TEMPLATES.ka.geo_breach_driver).not.toMatch(/გადასცა\b/);
    expect(DEFAULT_TEMPLATES.en.geo_breach_driver).toContain("has the right");
  });

  it("names the car in every red-line text, and the plate", () => {
    for (const key of ["geo_approach_driver", "geo_approach_owner", "geo_breach_driver", "geo_breach_owner"] as const) {
      for (const locale of ["ka", "en"] as const) {
        expect(defaultTemplate(locale, key), `${locale} ${key}`).toContain("{asset}");
        expect(defaultTemplate(locale, key), `${locale} ${key}`).toContain("{plate}");
      }
    }
  });

  it("every text to a renter says who is writing and how to reach them", () => {
    for (const key of TEMPLATE_KEYS) {
      if (TEMPLATE_ROLE[key] === "owner") continue;
      for (const locale of ["ka", "en"] as const) {
        expect(defaultTemplate(locale, key), `${locale} ${key}`).toContain("{owner}");
        expect(defaultTemplate(locale, key), `${locale} ${key}`).toContain("{owner_phone}");
      }
    }
    // "Pay by": the late-but-tolerated texts give the last day.
    for (const key of ["pay_overdue_driver", "lease_overdue_tenant"] as const) {
      expect(defaultTemplate("ka", key)).toContain("{deadline}");
      expect(defaultTemplate("en", key)).toContain("{deadline}");
    }
  });

  it("is formal to renters and informal to the owner (Georgian)", () => {
    // Renter texts: the formal plural (დაუკავშირდით, გთხოვთ, დაფაროთ).
    expect(DEFAULT_TEMPLATES.ka.pay_repossess_driver).toContain("დაუკავშირდით");
    expect(DEFAULT_TEMPLATES.ka.lease_overdue_tenant).toContain("გთხოვთ");
    // Owner texts: the informal singular (დაუკავშირდი, გაქვს, შეატყობინე).
    expect(DEFAULT_TEMPLATES.ka.geo_breach_owner).toContain("დაუკავშირდი ");
    expect(DEFAULT_TEMPLATES.ka.geo_breach_owner).toContain("შეატყობინე ");
    expect(DEFAULT_TEMPLATES.ka.pay_repossess_owner).toContain("გაქვს");
    for (const key of TEMPLATE_KEYS) {
      if (TEMPLATE_ROLE[key] !== "owner") continue;
      expect(DEFAULT_TEMPLATES.ka[key], key).not.toMatch(/დაუკავშირდით|შეატყობინეთ|გაქვთ|თქვენ/);
    }
    // One word for the contract.
    for (const key of TEMPLATE_KEYS) expect(DEFAULT_TEMPLATES.ka[key], key).not.toContain("კონტრაქტ");
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

  it("keeps a [bracketed part] only when its values are known", () => {
    const body = "{asset}[ ({plate})] — {owner}[, {owner_phone}]";
    expect(render(body, { asset: "პრიუსი", plate: "AA-001-AA", owner: "ლევანი", owner_phone: "+995599000000" })).toBe(
      "პრიუსი (AA-001-AA) — ლევანი, +995599000000",
    );
    expect(render(body, { asset: "პრიუსი", plate: MISSING, owner: "ლევანი", owner_phone: "" })).toBe("პრიუსი — ლევანი");
    // Brackets without a placeholder are the owner's own text.
    expect(render("[შენიშვნა] {asset}", { asset: "x" })).toBe("[შენიშვნა] x");
  });
});

describe("messageVars", () => {
  it("uses the Georgian name, the owner's name and number, and a written-out date", () => {
    const vars = baseVars(
      "ka",
      { name: "Toyota Prius", nameKa: "ტოიოტა პრიუსი", plateNumber: "AA-001-AA" },
      { name: "ლევანი", notifyPhone: "599 12 34 56" },
      "დავითი",
    );
    expect(vars).toMatchObject({
      asset: "ტოიოტა პრიუსი",
      plate: "AA-001-AA",
      driver: "დავითი",
      owner: "ლევანი",
      owner_phone: "+995599123456",
    });
    expect(messageDate("ka", new Date("2026-10-05T00:00:00Z"))).toBe("5 ოქტომბერი, 2026");
    expect(messageDate("en", new Date("2026-10-05T00:00:00Z"))).toBe("5 October 2026");
  });

  it("falls back to a neutral sender and drops what is unknown", () => {
    const vars = baseVars("ka", { name: "Honda Fit" }, {}, null);
    expect(vars.owner).toBe("გამქირავებელი");
    const text = render(DEFAULT_TEMPLATES.ka.pay_due_driver, {
      ...vars,
      amount: "660",
      currency: "GEL",
      date: "5 ოქტომბერი, 2026",
    });
    expect(text).toBe(
      "შეხსენება: Honda Fit — გადასახდელია 660 GEL, გადახდის დღე: 5 ოქტომბერი, 2026. გმადლობთ. — გამქირავებელი",
    );
    expect(text).not.toMatch(/[{}[\]]/);
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

describe("fixed red-line texts, the 112 rule and the opt-out line", () => {
  it("only the driver red-line texts are fixed", () => {
    expect(isFixedTemplate("geo_breach_driver")).toBe(true);
    expect(isFixedTemplate("geo_approach_driver")).toBe(true);
    expect(isFixedTemplate("rent_due_renter")).toBe(false);
  });

  it("spots 112 as a number on its own, not inside another number", () => {
    expect(mentionsPolice("დარეკავთ 112-ზე")).toBe(true);
    expect(mentionsPolice("call 112")).toBe(true);
    expect(mentionsPolice("ანგარიში GE11200000")).toBe(false);
    expect(mentionsPolice("1120 ₾")).toBe(false);
  });

  it("the opt-out line speaks formally to the renter", () => {
    expect(optOutLine("ka")).toContain("აცნობეთ");
    expect(optOutLine("en")).toContain("Tell the owner");
  });
});
