import { beforeEach, describe, expect, it, vi } from "vitest";

// runAutomation records itself in SystemRun and lists the workspaces; the
// jobs themselves come in as deps. Only those two tables are faked here.
const db = vi.hoisted(() => ({
  runs: [] as { id: string; data: Record<string, unknown> }[],
  operators: [{ id: "op-a" }, { id: "op-b" }],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    systemRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `run-${db.runs.length + 1}`, data };
        db.runs.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.runs.find((r) => r.id === where.id)!;
        row.data = { ...row.data, ...data };
        return row;
      },
    },
    operator: { findMany: async () => db.operators },
  },
}));

import { RUN_BUDGET_MS, runAutomation, SYNC_BUDGET_MS, type RunDeps } from "./run";

const now = new Date("2026-09-30T04:00:00Z");

function deps(overrides: Partial<RunDeps> = {}): RunDeps & { pruneCalls: Date[] } {
  const pruneCalls: Date[] = [];
  return {
    sync: vi.fn(async () => []) as unknown as RunDeps["sync"],
    scan: vi.fn(async () => ({ created: 1, resolved: 0 })) as unknown as RunDeps["scan"],
    flush: vi.fn(async () => ({ sent: 0, failed: 0, pending: 0 })) as unknown as RunDeps["flush"],
    prune: async (at) => {
      pruneCalls.push(at);
      return { sessions: 3, attempts: 2, resets: 1 };
    },
    pruneCalls,
    ...overrides,
  };
}

describe("the automatic run", () => {
  beforeEach(() => {
    db.runs.length = 0;
  });

  it("prunes old sign-in records once per daily run, after the workspaces", async () => {
    const d = deps();
    const { ok, summary } = await runAutomation("daily", now, d);
    expect(ok).toBe(true);
    expect(d.pruneCalls).toEqual([now]);
    expect(summary.authRowsPruned).toBe(6);
    expect(summary.alertsCreated).toBe(2);
    expect(db.runs[0].data.ok).toBe(true);
  });

  it("does not prune on the hourly calendar-only run", async () => {
    const d = deps();
    const { summary } = await runAutomation("sync", now, d);
    expect(d.pruneCalls).toEqual([]);
    expect(summary.authRowsPruned).toBe(0);
  });

  it("a failed prune fails the run without marking any workspace", async () => {
    const d = deps({
      prune: async () => {
        throw new Error("db down");
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ok, summary } = await runAutomation("daily", now, d);
    spy.mockRestore();
    expect(ok).toBe(false);
    expect(summary.pruneFailed).toBe(true);
    expect(summary.failedOperators).toEqual([]);
    expect(summary.errors).toEqual(["prune: db down"]);
  });
});

describe("the run's time budget and the silence check", () => {
  beforeEach(() => {
    db.runs.length = 0;
  });

  it("past the sync budget, calendars are skipped but every workspace is still scanned", async () => {
    const d = deps({ elapsed: () => SYNC_BUDGET_MS + 1 });
    const { ok, summary } = await runAutomation("daily", now, d);
    expect(d.sync).not.toHaveBeenCalled();
    expect(d.scan).toHaveBeenCalledTimes(2);
    expect(ok).toBe(true);
    expect(summary.alertsCreated).toBe(2);
  });

  it("past the run budget, the remaining workspaces are recorded as not done", async () => {
    const d = deps({ elapsed: () => RUN_BUDGET_MS + 1 });
    const { ok, summary } = await runAutomation("daily", now, d);
    expect(d.scan).not.toHaveBeenCalled();
    expect(ok).toBe(false);
    expect(summary.failedOperators).toEqual(["op-a", "op-b"]);
  });

  it("the calendar-only run also checks for silent trackers", async () => {
    const silence = vi.fn(async () => 1);
    const { summary } = await runAutomation("sync", now, deps({ silence }));
    expect(silence).toHaveBeenCalledTimes(2);
    expect(summary.alertsCreated).toBe(2);
  });
});
