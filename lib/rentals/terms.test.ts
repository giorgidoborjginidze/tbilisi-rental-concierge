import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_ROLE,
  paymentTemplates,
  templateKeysFor,
  type TemplateKey,
} from "@/lib/notify/templates";
import { contractTerms, statusFor } from "./terms";
import { applyPayment } from "./ledger";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("per-period rates", () => {
  const taxi = {
    startDate: d("2026-09-20"),
    endDate: d("2027-09-20"),
    paymentPeriod: "daily",
    paymentAmount: 60,
    monthlyRent: 1826.4,
    graceDays: 3,
    paidThrough: d("2026-09-22"),
    creditBalance: 0,
  };
  // Weekend +20%, holiday +30%, as on the audited Prius.
  const pricing = { dailyRate: 60, weekendPct: 20, holidayPct: 30 };

  it("charges the day amount the owner typed, weekends priced up", () => {
    const status = statusFor(taxi, d("2026-09-30"), pricing);
    // 22–30 Sep: 9 days, of which 26 and 27 are a weekend (72 each).
    expect(status.periodsOwed).toBe(9);
    expect(status.amountDue).toBe(7 * 60 + 2 * 72);
    expect(status.state).toBe("repossess");
  });

  it("the ledger walks the same prices, so the amount shown settles it", () => {
    const status = statusFor(taxi, d("2026-09-30"), pricing);
    const step = applyPayment(
      contractTerms(taxi, pricing),
      { paidThrough: taxi.paidThrough, credit: 0 },
      status.amountDue,
    );
    expect(step.covered).toBe(9);
    expect(step.state).toEqual({ paidThrough: d("2026-10-01"), credit: 0 });
  });

  it("nets the credit off what is still to pay", () => {
    const status = statusFor({ ...taxi, creditBalance: 50 }, d("2026-09-30"), pricing);
    expect(status.amountDue).toBe(7 * 60 + 2 * 72 - 50);
  });

  it("does not bill a monthly lease per day", () => {
    const flat = {
      startDate: d("2026-03-01"),
      endDate: d("2027-03-01"),
      paymentPeriod: "monthly",
      paymentAmount: 1200,
      monthlyRent: 1200,
      graceDays: 3,
      paidThrough: d("2026-09-01"),
    };
    const status = statusFor(flat, d("2026-09-02"), null);
    expect(status.periodsOwed).toBe(1);
    expect(status.amountDue).toBe(1200);
  });
});

describe("messages follow the asset category", () => {
  it("keeps the vehicle wording for cars", () => {
    const keys = paymentTemplates("vehicle");
    expect(keys.late).toBe("pay_repossess_driver");
    expect(keys.lateOwner).toBe("pay_repossess_owner");
    expect(TEMPLATE_ROLE[keys.late]).toBe("driver");
  });

  it("gives flats lease wording — no vehicle, no 112", () => {
    for (const category of ["real_estate", "other"]) {
      const keys = paymentTemplates(category);
      expect(keys.late).toBe("lease_late_tenant");
      for (const key of Object.values(keys) as TemplateKey[]) {
        for (const locale of ["ka", "en"] as const) {
          const body = DEFAULT_TEMPLATES[locale][key];
          expect(body, `${locale}:${key}`).not.toMatch(/vehicle|ავტომობ|მანქან|112|driver|მძღოლ/i);
        }
      }
      expect(TEMPLATE_ROLE[keys.due]).toBe("tenant");
      expect(TEMPLATE_ROLE[keys.lateOwner]).toBe("owner");
    }
  });

  it("addresses the tenant formally in Georgian", () => {
    expect(DEFAULT_TEMPLATES.ka.lease_late_tenant).toContain("გთხოვთ");
    expect(DEFAULT_TEMPLATES.ka.lease_overdue_tenant).toContain("გთხოვთ");
  });

  it("shows each asset only the templates that apply to it", () => {
    expect(templateKeysFor("real_estate")).toEqual([
      "lease_due_tenant",
      "lease_overdue_tenant",
      "lease_late_tenant",
      "lease_late_owner",
    ]);
    expect(templateKeysFor("vehicle")).toContain("geo_breach_driver");
    expect(templateKeysFor("vehicle")).not.toContain("lease_due_tenant");
  });
});
