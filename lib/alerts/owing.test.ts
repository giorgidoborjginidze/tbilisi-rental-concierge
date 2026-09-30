import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { owingEndings } from "./owing";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const contract = (id: string, paidThrough: string | null) => ({
  id,
  startDate: day("2026-06-01"),
  endDate: day("2026-09-01"),
  paymentPeriod: "monthly",
  paymentAmount: 1000,
  monthlyRent: 1000,
  graceDays: 3,
  paidThrough: paidThrough ? day(paidThrough) : null,
  creditBalance: 0,
  pricing: null,
});

describe("owingEndings", () => {
  const today = day("2026-09-30");
  const contracts = new Map([
    ["owes", contract("owes", "2026-08-01")],
    ["clean", contract("clean", "2026-09-01")],
    ["untracked", contract("untracked", null)],
  ]);

  it("an ending with rent still owed is rent; a clean or untracked ending is advice", () => {
    const alerts = [
      { id: "a1", type: "contract_ended", payload: { contractId: "owes" } },
      { id: "a2", type: "contract_ended", payload: { contractId: "clean" } },
      { id: "a3", type: "contract_ended", payload: { contractId: "untracked" } },
      { id: "a4", type: "contract_ended", payload: { contractId: "deleted" } },
      { id: "a5", type: "contract_ended", payload: null },
      { id: "a6", type: "rent_overdue", payload: { contractId: "owes" } },
    ];
    expect([...owingEndings(alerts, contracts, today)]).toEqual(["a1"]);
  });
});
