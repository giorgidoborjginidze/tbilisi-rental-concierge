import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  alerts: [] as { id: string; type: string; unitId: string | null; payload: unknown; ownerNotifiedAt: Date | null }[],
  operator: null as null | Record<string, unknown>,
  deleted: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    alert: {
      findMany: async () => db.alerts.filter((a) => !a.ownerNotifiedAt),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { ownerNotifiedAt: Date } }) => {
        let count = 0;
        for (const alert of db.alerts) {
          if (where.id.in.includes(alert.id) && !alert.ownerNotifiedAt) {
            alert.ownerNotifiedAt = data.ownerNotifiedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
    operator: { findUnique: async () => db.operator },
    unit: { findMany: async () => [{ id: "u1", name: "Vake 2BR", nameKa: "ვაკე 2 ოთახი" }] },
    asset: {
      findMany: async () => [
        { id: "car1", name: "Prius", nameKa: null, category: "vehicle", _count: { contracts: 1 } },
      ],
    },
    pushSubscription: {
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        db.deleted.push(...where.id.in);
        return { count: where.id.in.length };
      },
    },
  },
}));

import { notifyOwner, ownerDigest, ownerNotes, pushBatch, PUSH_MAX, type NotifyDeps, type OwnerNote } from "./owner";

const now = new Date("2026-10-01T04:00:00Z");
const push = { publicKey: "pub", privateKey: "priv", subject: "https://activo.world" };
const email = { apiKey: "k", from: "Activo <no-reply@activo.world>" };

function deps(over: Partial<NotifyDeps> = {}): NotifyDeps & { sent: OwnerNote[]; mails: unknown[] } {
  const sent: OwnerNote[] = [];
  const mails: unknown[] = [];
  return {
    push,
    email,
    send: async (_target, note) => {
      sent.push(note);
      return 201;
    },
    mail: async (message) => {
      mails.push(message);
      return true;
    },
    origin: "https://activo.world",
    sent,
    mails,
    ...over,
  };
}

beforeEach(() => {
  db.alerts = [
    { id: "a1", type: "overlap", unitId: "u1", payload: { start: "2026-10-03" }, ownerNotifiedAt: null },
    { id: "a2", type: "geofence_breach", unitId: null, payload: { assetId: "car1" }, ownerNotifiedAt: null },
  ];
  db.operator = {
    email: "owner@example.com",
    locale: "ka",
    notifyEmail: true,
    isDemo: false,
    pushSubscriptions: [{ id: "s1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" }],
  };
  db.deleted = [];
});

describe("owner notifications", () => {
  it("words each alert as the alerts page does, with its place and link", () => {
    const notes = ownerNotes(
      "en",
      [
        { id: "a", type: "repossession_right", unitId: null, payload: { assetId: "flat", category: "real_estate" } },
        { id: "b", type: "overlap", unitId: null, payload: { assetId: "flat" } },
      ],
      new Map(),
      new Map([["flat", { name: "Saburtalo flat", category: "real_estate", desk: "property" as const }]]),
    );
    expect(notes[0]).toMatchObject({ title: "Rent Late — Grace Over", body: "Saburtalo flat" });
    expect(notes[1].title).toBe("Contracts Overlap");
    expect(notes[1].url).toBe("/assets/flat/edit#contracts");
  });

  it("sums up the rest when there are many", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ tag: `t${i}`, title: "T", body: "B", url: "/alerts" }));
    const batch = pushBatch("en", many);
    expect(batch).toHaveLength(PUSH_MAX);
    expect(batch.at(-1)!.title).toBe("And 4 more alerts");
  });

  it("emails one digest with links and the way to turn it off", () => {
    const digest = ownerDigest("en", [{ tag: "a", title: "Double <Booking>", body: "Vake", url: "/calendar?unit=u1" }], "https://activo.world");
    expect(digest.subject).toBe("Activo — Double <Booking>");
    expect(digest.text).toContain("https://activo.world/calendar?unit=u1");
    expect(digest.text).toContain("/settings#notifications");
    expect(digest.html).toContain("Double &lt;Booking&gt;");
  });

  it("pushes and emails fresh urgent alerts once", async () => {
    const first = deps();
    const outcome = await notifyOwner("op", now, first);
    expect(outcome).toEqual({ alerts: 2, pushed: 2, emailed: true });
    expect(first.sent.map((n) => n.title)).toEqual(["ორმაგი ჯავშანი", "წითელი ხაზი გადაკვეთილია"]);
    expect(first.sent[0].body).toBe("ვაკე 2 ოთახი");
    expect(first.mails).toHaveLength(1);

    const again = deps();
    expect(await notifyOwner("op", now, again)).toEqual({ alerts: 0, pushed: 0, emailed: false });
    expect(again.sent).toHaveLength(0);
  });

  it("respects the email switch and forgets devices that are gone", async () => {
    db.operator!.notifyEmail = false;
    const run = deps({ send: async () => 410 });
    const outcome = await notifyOwner("op", now, run);
    expect(outcome.emailed).toBe(false);
    expect(run.mails).toHaveLength(0);
    expect(db.deleted).toEqual(["s1"]);
  });

  it("never sends for the demo account", async () => {
    db.operator!.isDemo = true;
    const run = deps();
    const outcome = await notifyOwner("op", now, run);
    expect(outcome.pushed).toBe(0);
    expect(run.sent).toHaveLength(0);
    expect(run.mails).toHaveLength(0);
  });
});
