import { beforeEach, describe, expect, it, vi } from "vitest";

// The undo of deleting a file takes its snapshot from the browser: it may
// only put back this workspace's own file, exactly as stored.

const db = vi.hoisted(() => ({ created: [] as Record<string, unknown>[] }));

vi.mock("@/lib/auth/session", () => ({
  requireWriter: async () => ({ id: "wsA", userId: "wsA", role: "owner", isDemo: false }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/activity/log", () => ({ logActivity: async () => {} }));
// The stored bytes: 3 MB, whatever size the snapshot claims.
vi.mock("@/lib/files/store", () => ({
  fileStore: () => ({
    get: async () => ({ stream: new Blob([new Uint8Array(1)]).stream(), contentType: "application/pdf", size: 3_000_000 }),
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    attachment: {
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.created.push(data);
        return data;
      },
    },
    asset: { count: async () => 1 },
    unit: { count: async () => 1 },
  },
}));

import { restoreAttachment } from "./actions";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const restore = (snap: Record<string, unknown>) => {
  const form = new FormData();
  form.set("snapshot", JSON.stringify({ assetId: "a1", kind: "document", name: "x.pdf", size: 1000, ...snap }));
  return restoreAttachment(form);
};

describe("restoreAttachment", () => {
  beforeEach(() => {
    db.created.length = 0;
  });

  it.each([
    `op/wsA/../wsB/${UUID}.pdf`,
    `op/wsA/./../wsB/${UUID}.jpg`,
    `op/wsA/sub/../../wsB/${UUID}.png`,
    `op/wsA/..%2FwsB/${UUID}.pdf`,
    `op/wsA\\..\\wsB\\${UUID}.pdf`,
    `op/wsA//${UUID}.pdf`,
  ])("refuses a path that leaves the workspace's folder: %s", async (pathname) => {
    expect(await restore({ pathname })).toBe(false);
    expect(db.created).toHaveLength(0);
  });

  it("takes the size from the stored file, so the storage quota cannot be dodged", async () => {
    expect(await restore({ pathname: `op/wsA/${UUID}.pdf`, size: 0 })).toBe(true);
    expect(db.created[0]).toMatchObject({ size: 3_000_000 });
  });

  it("puts back the workspace's own file", async () => {
    expect(await restore({ pathname: `op/wsA/${UUID}.pdf` })).toBe(true);
    expect(db.created[0]).toMatchObject({ operatorId: "wsA", pathname: `op/wsA/${UUID}.pdf` });
  });
});
