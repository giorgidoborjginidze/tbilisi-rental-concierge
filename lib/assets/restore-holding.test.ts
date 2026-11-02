import { beforeEach, describe, expect, it, vi } from "vitest";

// The undo of deleting a holding takes its snapshot from the browser. Only
// the holding's own plain fields may come back from it: never a nested
// relation write that reaches rows of another workspace (a tracker, a
// contract, a file).

const tx = vi.hoisted(() => ({
  asset: { create: vi.fn() },
  cryptoTrade: { createMany: vi.fn() },
  incomeRecord: { updateMany: vi.fn() },
}));

vi.mock("@/lib/auth/session", () => ({
  requireWriter: async () => ({ id: "wsA", userId: "wsA", role: "owner", isDemo: false }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/activity/log", () => ({ logActivity: async () => {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    asset: { findUnique: async () => null },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

import { restoreHolding } from "./actions";

const restore = (asset: Record<string, unknown>) => {
  const form = new FormData();
  form.set("snapshot", JSON.stringify({ asset, trades: [], incomeIds: [] }));
  return restoreHolding(form);
};

const RELATIONS = ["gpsDevice", "contracts", "attachments", "invoices", "incomes", "geofences", "days", "trades", "unit", "operator"];

describe("restoreHolding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never passes a nested relation write from the snapshot to the database", async () => {
    await restore({
      id: "new-holding",
      name: "x",
      category: "crypto",
      type: "coin",
      gpsDevice: { connect: { deviceId: "victim-imei" } },
      contracts: { connect: [{ id: "victim-contract" }] },
      attachments: { create: [{ operatorId: "wsB", pathname: "op/wsB/f.pdf" }] },
    });
    const data = tx.asset.create.mock.calls[0]?.[0]?.data ?? {};
    for (const key of RELATIONS) expect(data).not.toHaveProperty(key);
  });

  it("keeps the holding in the signed-in workspace whatever the snapshot says", async () => {
    await restore({ id: "h2", name: "BTC", category: "crypto", type: "coin", operatorId: "wsB", unitId: "u-of-B" });
    const data = tx.asset.create.mock.calls[0][0].data;
    expect(data.operatorId).toBe("wsA");
    expect(data.unitId).toBeNull();
    expect(data.name).toBe("BTC");
  });
});
