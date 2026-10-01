import { describe, expect, it } from "vitest";
import { KEEP, neonConfig, rotateSnapshot, snapshotName, type NeonApi, type Snapshot } from "./neon-snapshot";

const NOW = new Date("2026-10-02T04:00:00Z");

function fakeApi(start: Snapshot[], limit: number) {
  const snaps = [...start];
  let seq = 0;
  const api: NeonApi = {
    defaultBranchId: async () => "br-main",
    list: async () => [...snaps],
    create: async (_branch, name) => {
      if (snaps.length >= limit) return { ok: false, limit: true, error: "422 snapshots limit exceeded" };
      snaps.push({ id: `snap-${++seq}`, name, created_at: `2026-10-02T04:00:0${seq}Z` });
      return { ok: true };
    },
    remove: async (id) => {
      const i = snaps.findIndex((s) => s.id === id);
      if (i >= 0) snaps.splice(i, 1);
    },
  };
  return { api, snaps };
}

const own = (n: number, day: string): Snapshot => ({
  id: `old-${n}`,
  name: `activo-auto-daily-${day}`,
  created_at: `${day}T04:00:00Z`,
});

describe("rotateSnapshot", () => {
  it("replaces its own snapshot on the free plan's one-snapshot limit", async () => {
    const { api, snaps } = fakeApi([own(1, "2026-10-01")], 1);
    const out = await rotateSnapshot(api, "daily", NOW);
    expect(out).toEqual({ status: "created", name: snapshotName("daily", NOW), deleted: ["activo-auto-daily-2026-10-01"] });
    expect(snaps.map((s) => s.name)).toEqual([snapshotName("daily", NOW)]);
  });

  it("never deletes a snapshot someone made by hand", async () => {
    const manual = { id: "m", name: "before-big-change", created_at: "2026-09-01T00:00:00Z" };
    const { api, snaps } = fakeApi([manual], 1);
    const out = await rotateSnapshot(api, "daily", NOW);
    expect(out.status).toBe("failed");
    expect(snaps).toEqual([manual]);
  });

  it("keeps the newest KEEP of its own on a plan with room", async () => {
    const start = Array.from({ length: KEEP }, (_, i) => own(i, `2026-09-${String(20 + i).padStart(2, "0")}`));
    const { api, snaps } = fakeApi(start, 50);
    const out = await rotateSnapshot(api, "daily", NOW);
    expect(out.status).toBe("created");
    expect(snaps).toHaveLength(KEEP);
    expect(snaps.some((s) => s.id === "old-0")).toBe(false);
  });

  it("reports an API failure instead of throwing", async () => {
    const { api } = fakeApi([], 1);
    api.defaultBranchId = async () => {
      throw new Error("401 unauthorized");
    };
    expect(await rotateSnapshot(api, "daily", NOW)).toEqual({ status: "failed", error: "401 unauthorized" });
  });
});

describe("neonConfig", () => {
  it("needs both the key and the project id", () => {
    expect(neonConfig({ NEON_API_KEY: "k" })).toBeNull();
    expect(neonConfig({ NEON_API_KEY: "k", DATABASE_NEON_PROJECT_ID: "p" })).toEqual({
      apiKey: "k",
      projectId: "p",
    });
  });
});
