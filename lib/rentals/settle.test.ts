import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../app/generated/prisma/client";
import {
  dueDateOfDedupeKey,
  geoEventOfDedupeKey,
  restoreAfterUndo,
  settlePaidRent,
  staleGeoMessage,
  stalePaymentMessage,
  sweepStaleMessages,
  sweepStaleRentAlerts,
  withdrawContract,
} from "./settle";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

// ── A tiny in-memory stand-in for the two tables settle.ts touches. ──
type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([field, cond]) => {
    const value = row[field];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; gte?: Date; lte?: Date; not?: unknown };
      if (c.in && !c.in.includes(value)) return false;
      if (c.gte && !(value instanceof Date && value >= c.gte)) return false;
      if (c.lte && !(value instanceof Date && value <= c.lte)) return false;
      if ("not" in c && value === c.not) return false;
      return true;
    }
    return value === cond;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      rows.filter((row) => matches(row, where)),
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
  };
}

function fakeDb(alerts: Row[], messages: Row[], contracts: Row[] = [], events: Row[] = []) {
  return {
    alert: table(alerts),
    notifyMessage: table(messages),
    rentalContract: table(contracts),
    geoEvent: table(events),
  } as unknown as PrismaClient & {
    alert: ReturnType<typeof table>;
    notifyMessage: ReturnType<typeof table>;
  };
}

const message = (id: string, dedupeKey: string, extra: Partial<Row> = {}): Row => ({
  id,
  contractId: "c1",
  dedupeKey,
  kind: "pay_repossess_driver",
  toRole: "driver",
  status: "queued",
  cancelReason: null,
  cancelledAt: null,
  error: null,
  ...extra,
});

const alert = (id: string, dueDate: string, extra: Partial<Row> = {}): Row => ({
  id,
  type: "repossession_right",
  status: "open",
  resolvedAt: null,
  payload: { key: `c1|${dueDate}`, contractId: "c1", dueDate },
  ...extra,
});

describe("dedupe keys", () => {
  it("reads the due date of a payment reminder and the event of a red-line text", () => {
    expect(dueDateOfDedupeKey("pay|c1|2026-09-22|late3")).toBe("2026-09-22");
    expect(dueDateOfDedupeKey("geo|e1|driver")).toBeNull();
    expect(geoEventOfDedupeKey("geo|e1|driver")).toBe("e1");
  });
});

describe("stale messages are never offered for sending", () => {
  const contract = {
    startDate: d("2026-09-01"),
    endDate: d("2027-09-01"),
    paidThrough: d("2026-10-01"),
    remindersEnabled: true,
  };

  it("a reminder about a due date that is now paid", () => {
    const m = { dedupeKey: "pay|c1|2026-09-22|repossess", kind: "pay_repossess_driver" };
    expect(stalePaymentMessage(m, contract, d("2026-09-30"))).toBe("paid");
    expect(
      stalePaymentMessage(m, { ...contract, paidThrough: d("2026-09-22") }, d("2026-09-30")),
    ).toBeNull();
  });

  it("a reminder for a contract that ended or was deleted", () => {
    const m = { dedupeKey: "pay|c1|2026-09-22|late2", kind: "lease_overdue_tenant" };
    expect(stalePaymentMessage(m, null, d("2026-09-30"))).toBe("contract_deleted");
    expect(
      stalePaymentMessage(
        m,
        { ...contract, paidThrough: d("2026-09-22"), endDate: d("2026-09-25") },
        d("2026-09-30"),
      ),
    ).toBe("contract_ended");
  });

  it("a tenant reminder once reminders are switched off (the owner's copy stays)", () => {
    const off = { ...contract, paidThrough: d("2026-09-22"), remindersEnabled: false };
    const key = "pay|c1|2026-09-22|repossess";
    expect(
      stalePaymentMessage({ dedupeKey: key, kind: "pay_repossess_driver", toRole: "driver" }, off, d("2026-09-30")),
    ).toBe("changed");
    expect(
      stalePaymentMessage({ dedupeKey: `${key}-owner`, kind: "pay_repossess_owner", toRole: "owner" }, off, d("2026-09-30")),
    ).toBeNull();
  });

  it("a red-line text once the vehicle is back inside", () => {
    const m = { dedupeKey: "geo|e1|driver", kind: "geo_breach_driver" };
    const event = { createdAt: new Date("2026-09-30T08:00:00Z") };
    expect(staleGeoMessage(m, event, null)).toBeNull();
    expect(staleGeoMessage(m, event, new Date("2026-09-30T07:00:00Z"))).toBeNull();
    expect(staleGeoMessage(m, event, new Date("2026-09-30T09:00:00Z"))).toBe("returned");
  });
});

describe("recording a payment withdraws what it settles — and undo brings it back", () => {
  const paidAt = new Date("2026-09-30T10:00:00Z");

  it("cancels every unsent reminder (none is deleted) and resolves paid alerts", async () => {
    const db = fakeDb(
      [alert("a1", "2026-09-22"), alert("a2", "2026-09-22", { payload: { contractId: "other", dueDate: "2026-09-22" } })],
      [
        message("m1", "pay|c1|2026-09-22|repossess"),
        message("m2", "pay|c1|2026-09-22|repossess-owner", { kind: "pay_repossess_owner", toRole: "owner" }),
        message("m3", "pay|c1|2026-09-22|late1", { status: "sent" }),
        message("m4", "geo|e1|driver", { kind: "geo_breach_driver" }),
      ],
    );
    const result = await settlePaidRent(db, "c1", d("2026-10-01"), paidAt, { withdrawOwed: true });
    expect(result).toEqual({ resolved: 1, cancelled: 2 });
    const byId = (id: string) => db.notifyMessage.rows.find((r) => r.id === id)!;
    expect(byId("m1")).toMatchObject({ status: "cancelled", cancelReason: "paid", cancelledAt: paidAt });
    expect(byId("m2").status).toBe("cancelled");
    expect(byId("m3").status).toBe("sent"); // history stays
    expect(byId("m4").status).toBe("queued"); // not a rent message
    expect(db.alert.rows[0]).toMatchObject({ status: "resolved", resolvedAt: paidAt });
    expect((db.alert.rows[0].payload as { autoResolved?: string }).autoResolved).toBe("paid");
    expect(db.alert.rows[1].status).toBe("open"); // another contract
  });

  it("a part payment still withdraws the reminder: its amount is no longer right", async () => {
    const db = fakeDb(
      [alert("a1", "2026-09-22")],
      [message("m1", "pay|c1|2026-09-22|late5")],
    );
    // Paid up to the 24th: the 22nd–23rd are settled, the 24th is still owed.
    await settlePaidRent(db, "c1", d("2026-09-24"), paidAt, { withdrawOwed: true });
    expect(db.notifyMessage.rows[0]).toMatchObject({ status: "cancelled", cancelReason: "paid" });
    const db2 = fakeDb([alert("a1", "2026-09-24")], [message("m1", "pay|c1|2026-09-24|late5")]);
    await settlePaidRent(db2, "c1", d("2026-09-24"), paidAt, { withdrawOwed: true });
    expect(db2.notifyMessage.rows[0]).toMatchObject({ status: "cancelled", cancelReason: "changed" });
    expect(db2.alert.rows[0].status).toBe("open"); // that due date is still unpaid
  });

  it("undo reopens the alert and re-queues the reminder the payment withdrew", async () => {
    const db = fakeDb([alert("a1", "2026-09-22")], [message("m1", "pay|c1|2026-09-22|repossess")]);
    await settlePaidRent(db, "c1", d("2026-10-01"), paidAt, { withdrawOwed: true });
    const restored = await restoreAfterUndo(db, "c1", d("2026-09-22"), paidAt);
    expect(restored).toEqual({ reopened: 1, requeued: 1 });
    expect(db.alert.rows[0]).toMatchObject({ status: "open", resolvedAt: null });
    expect((db.alert.rows[0].payload as { autoResolved?: string }).autoResolved).toBeUndefined();
    expect(db.notifyMessage.rows[0]).toMatchObject({ status: "queued", cancelReason: null });
  });

  it("undo leaves alone what the owner closed and what was withdrawn earlier", async () => {
    const earlier = new Date("2026-09-29T10:00:00Z");
    const db = fakeDb(
      [alert("a1", "2026-09-22", { status: "resolved", resolvedAt: paidAt })], // by hand
      [message("m1", "pay|c1|2026-09-22|late7", { status: "cancelled", cancelReason: "paid", cancelledAt: earlier })],
    );
    const restored = await restoreAfterUndo(db, "c1", d("2026-09-22"), paidAt);
    expect(restored).toEqual({ reopened: 0, requeued: 0 });
  });
});

describe("the deploy-time repair", () => {
  it("clears only what is paid — a reminder about rent still owed stays queued", async () => {
    const db = fakeDb(
      [alert("a1", "2026-09-22"), alert("a2", "2026-09-29")],
      [message("m1", "pay|c1|2026-09-22|late8"), message("m2", "pay|c1|2026-09-29|late1")],
    );
    const result = await settlePaidRent(db, "c1", d("2026-09-29"));
    expect(result).toEqual({ resolved: 1, cancelled: 1 });
    expect(db.notifyMessage.rows[1].status).toBe("queued");
    expect(db.alert.rows[1].status).toBe("open");
  });
});

describe("a deleted contract", () => {
  it("withdraws all its unsent messages and closes its alerts", async () => {
    const db = fakeDb(
      [alert("a1", "2026-09-22"), { ...alert("a2", "2026-09-22"), type: "contract_expiry" }],
      [message("m1", "pay|c1|2026-09-22|repossess"), message("m2", "geo|e1|driver", { kind: "geo_breach_driver" })],
    );
    const result = await withdrawContract(db, "c1", "contract_deleted");
    expect(result).toEqual({ resolved: 2, cancelled: 2 });
    expect(db.notifyMessage.rows.every((r) => r.cancelReason === "contract_deleted")).toBe(true);
  });
});

describe("the sweep before every send and at every scan", () => {
  const today = d("2026-09-30");
  const running = { id: "c1", startDate: d("2026-09-01"), endDate: d("2027-09-01"), paidThrough: d("2026-10-01"), remindersEnabled: true };

  it("withdraws reminders for paid rent, ended or deleted contracts and returned vehicles", async () => {
    const db = fakeDb(
      [],
      [
        message("m1", "pay|c1|2026-09-22|repossess"), // paid since
        message("m2", "pay|c2|2026-08-01|repossess", { contractId: "c2" }), // contract ended
        message("m3", "pay|gone|2026-09-22|late2", { contractId: "gone" }), // deleted
        message("m4", "pay|c1|2026-10-01|due"), // still to pay: stays
        message("m5", "geo|e1|driver", { kind: "geo_breach_driver", contractId: "c1" }),
        message("m6", "geo|e2|driver", { kind: "geo_breach_driver", contractId: "c1" }),
      ],
      [running, { id: "c2", startDate: d("2026-01-01"), endDate: d("2026-09-01"), paidThrough: d("2026-08-01") }],
      [
        { id: "e1", geofenceId: "f1", kind: "breach", createdAt: new Date("2026-09-30T08:00:00Z") },
        { id: "r1", geofenceId: "f1", kind: "return", createdAt: new Date("2026-09-30T09:00:00Z") },
        { id: "e2", geofenceId: "f2", kind: "breach", createdAt: new Date("2026-09-30T08:00:00Z") },
      ],
    );
    expect(await sweepStaleMessages(db, today)).toBe(4);
    const reason = (id: string) => db.notifyMessage.rows.find((r) => r.id === id)!.cancelReason;
    expect(reason("m1")).toBe("paid");
    expect(reason("m2")).toBe("contract_ended");
    expect(reason("m3")).toBe("contract_deleted");
    expect(reason("m4")).toBeNull();
    expect(reason("m5")).toBe("returned");
    expect(reason("m6")).toBeNull(); // still outside that other line
  });

  it("closes late-rent alerts whose due date is paid or whose contract is over", async () => {
    const db = fakeDb(
      [
        alert("a1", "2026-09-22"), // paid
        alert("a2", "2026-10-01"), // not yet
        alert("a3", "2026-08-01", { payload: { contractId: "c2", dueDate: "2026-08-01" } }),
      ],
      [],
      [running, { id: "c2", startDate: d("2026-01-01"), endDate: d("2026-09-01"), paidThrough: d("2026-08-01") }],
    );
    expect(await sweepStaleRentAlerts(db, today)).toBe(2);
    const auto = (id: string) =>
      (db.alert.rows.find((r) => r.id === id)!.payload as { autoResolved?: string }).autoResolved;
    expect(auto("a1")).toBe("paid");
    expect(auto("a2")).toBeUndefined();
    expect(auto("a3")).toBe("contract_ended");
  });
});
