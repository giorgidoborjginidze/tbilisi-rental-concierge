import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => [
  { district: "Vake", month: "2026-07", adr: 150, occupancyRate: 0.7 },
  { district: "Vake", month: "2025-07", adr: 120, occupancyRate: 0.6 },
  { district: "Saburtalo", month: "2027-07", adr: 110, occupancyRate: 0.5 },
  { district: "Saburtalo", month: "2026-07", adr: 100, occupancyRate: 0.5 },
]);

type Where = { district?: string | { in: string[] }; month?: { endsWith: string }; district_month?: { district: string; month: string } };
const matches = (row: (typeof rows)[number], where: Where) => {
  if (where.district_month) return row.district === where.district_month.district && row.month === where.district_month.month;
  const d = where.district;
  if (typeof d === "string" && row.district !== d) return false;
  if (d && typeof d === "object" && !d.in.includes(row.district)) return false;
  return !where.month || row.month.endsWith(where.month.endsWith);
};
const sorted = (list: typeof rows) => [...list].sort((a, b) => b.month.localeCompare(a.month));

vi.mock("@/lib/db", () => {
  const model = {
    findUnique: async ({ where }: { where: Where }) => rows.find((row) => matches(row, where)) ?? null,
    findFirst: async ({ where }: { where: Where }) => sorted(rows.filter((row) => matches(row, where)))[0] ?? null,
    findMany: async ({ where }: { where: Where }) => sorted(rows.filter((row) => matches(row, where))),
  };
  return { prisma: { marketBenchmark: model, rentBenchmark: model } };
});

import { seededMany, seededMarketBenchmark } from "./seeded";

describe("seeded estimates", () => {
  it("use the asked month when there is one", async () => {
    expect((await seededMarketBenchmark("Vake", "2026-07"))?.adr).toBe(150);
  });

  it("fall back to the same month of the latest year, not to nothing", async () => {
    expect((await seededMarketBenchmark("Vake", "2027-07"))?.adr).toBe(150);
    expect(await seededMarketBenchmark("Vake", "2027-08")).toBeNull();
  });

  it("does the same for many districts, the exact month winning", async () => {
    const many = await seededMany("market", ["Vake", "Saburtalo"], "2026-07");
    expect(many.get("Vake")?.adr).toBe(150);
    expect(many.get("Saburtalo")?.adr).toBe(100);
    const later = await seededMany("market", ["Vake", "Saburtalo"], "2028-07");
    expect(later.get("Saburtalo")?.adr).toBe(110);
  });
});
