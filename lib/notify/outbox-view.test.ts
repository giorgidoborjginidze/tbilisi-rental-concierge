import { describe, expect, it } from "vitest";
import { outboxView, type OutboxRow } from "./outbox-view";

const now = new Date("2026-09-30T12:00:00Z");
const row = (id: string, extra: Partial<OutboxRow>): OutboxRow & { id: string } => ({
  id,
  status: "queued",
  toRole: "driver",
  createdAt: new Date("2026-09-30T08:00:00Z"),
  sentAt: null,
  cancelledAt: null,
  stale: null,
  ...extra,
});

describe("outboxView", () => {
  it("lists what still has to go out across assets, oldest first", () => {
    const rows = [
      row("b", { createdAt: new Date("2026-09-30T09:00:00Z") }),
      row("a", { createdAt: new Date("2026-09-29T09:00:00Z"), toRole: "tenant" }),
      row("f", { status: "failed" }),
    ];
    expect(outboxView(rows, false, now).waiting.map((r) => r.id)).toEqual(["a", "f", "b"]);
  });

  it("sent by hand, notes to the owner's own number are left out (and counted)", () => {
    const rows = [row("d", {}), row("o", { toRole: "owner" })];
    const manual = outboxView(rows, false, now);
    expect(manual.waiting.map((r) => r.id)).toEqual(["d"]);
    expect(manual.hiddenOwner).toBe(1);
    const auto = outboxView(rows, true, now);
    expect(auto.waiting.map((r) => r.id)).toEqual(["d", "o"]);
    expect(auto.hiddenOwner).toBe(0);
  });

  it("a stale reminder is not offered; sent and withdrawn ones of the last week are recent", () => {
    const rows = [
      row("stale", { stale: "paid" }),
      row("sent", { status: "sent", sentAt: new Date("2026-09-29T10:00:00Z") }),
      row("old", { status: "sent", sentAt: new Date("2026-09-01T10:00:00Z") }),
      row("gone", { status: "cancelled", cancelledAt: new Date("2026-09-30T10:00:00Z") }),
    ];
    const view = outboxView(rows, false, now);
    expect(view.waiting).toEqual([]);
    expect(view.recent.map((r) => r.id)).toEqual(["gone", "stale", "sent"]);
  });
});
