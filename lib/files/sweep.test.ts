import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    attachment: {
      findMany: async ({ where }: { where: { pathname: { in: string[] } } }) =>
        where.pathname.in.filter((p) => p.includes("kept")).map((pathname) => ({ pathname })),
    },
  },
}));

import { sweepOrphanFiles } from "./sweep";
import type { FileStore } from "./store";

describe("file sweep", () => {
  it("removes old files without a record and leaves fresh uploads", async () => {
    const now = new Date("2026-10-02T04:00:00Z");
    const deleted: string[] = [];
    const store: FileStore = {
      put: async () => {},
      get: async () => null,
      del: async (paths) => void deleted.push(...paths),
      list: async () => [
        { pathname: "op/a/kept.jpg", uploadedAt: new Date("2026-09-01") },
        { pathname: "op/a/gone.jpg", uploadedAt: new Date("2026-09-01") },
        { pathname: "op/a/just-now.jpg", uploadedAt: new Date(now.getTime() - 60_000) },
      ],
    };
    expect(await sweepOrphanFiles(now, store)).toBe(1);
    expect(deleted).toEqual(["op/a/gone.jpg"]);
    expect(await sweepOrphanFiles(now, null)).toBe(0);
  });
});
