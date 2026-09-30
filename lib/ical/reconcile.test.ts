import { describe, expect, it } from "vitest";
import { planFeedSync, type KnownStay } from "./reconcile";
import type { BookingCandidate } from "./sync";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const NOW = new Date("2026-09-30T10:00:00Z");
const FEED = "feed-1";

const candidate = (externalId: string, checkIn: string, checkOut: string, status = "confirmed"): BookingCandidate => ({
  source: "airbnb",
  checkIn: d(checkIn),
  checkOut: d(checkOut),
  nights: Math.round((d(checkOut).getTime() - d(checkIn).getTime()) / 86_400_000),
  status,
  externalId,
});

const known = (id: string, externalId: string, checkOut: string, extra: Partial<KnownStay> = {}): KnownStay => ({
  id,
  externalId,
  feedId: FEED,
  status: "confirmed",
  cancelReason: null,
  cancelledAt: null,
  checkOut: d(checkOut),
  ...extra,
});

const context = { feedId: FEED, ownsLegacy: true, now: NOW };

describe("planFeedSync", () => {
  it("creates new stays and updates known ones", () => {
    const plan = planFeedSync(
      [candidate("a", "2026-10-02", "2026-10-05"), candidate("b", "2026-10-10", "2026-10-12")],
      [known("s1", "a", "2026-10-04")],
      context,
    );
    expect(plan.create.map((c) => c.externalId)).toEqual(["b"]);
    expect(plan.update).toEqual([
      {
        id: "s1",
        data: expect.objectContaining({
          checkOut: d("2026-10-05"),
          nights: 3,
          status: "confirmed",
          feedId: FEED,
          cancelReason: null,
        }),
      },
    ]);
    expect(plan.cancel).toEqual([]);
  });

  it("cancels a future stay that vanished from its feed", () => {
    const plan = planFeedSync(
      [candidate("a", "2026-10-02", "2026-10-05")],
      [
        known("s1", "a", "2026-10-05"),
        known("gone-future", "x", "2026-10-20"),
        // Checked in already, not out yet — still in the future: cancelled.
        known("gone-running", "y", "2026-10-01"),
        // Ended: feeds drop old stays, that is not a cancellation.
        known("gone-past", "z", "2026-09-20"),
        known("gone-cancelled", "w", "2026-10-20", { status: "cancelled" }),
      ],
      context,
    );
    expect(plan.cancel.sort()).toEqual(["gone-future", "gone-running"]);
  });

  it("only cancels stays of this feed (or legacy ones when it is the only feed)", () => {
    const stays = [
      known("other-feed", "x", "2026-10-20", { feedId: "feed-2" }),
      known("legacy", "y", "2026-10-20", { feedId: null }),
    ];
    expect(planFeedSync([], stays, context).cancel).toEqual(["legacy"]);
    expect(planFeedSync([], stays, { ...context, ownsLegacy: false }).cancel).toEqual([]);
  });

  it("an empty but valid calendar cancels every future stay of the feed", () => {
    const plan = planFeedSync([], [known("s1", "a", "2026-10-05")], context);
    expect(plan.cancel).toEqual(["s1"]);
  });

  it("revives a stay that comes back, but never one the owner cancelled", () => {
    const plan = planFeedSync(
      [candidate("back", "2026-10-02", "2026-10-05"), candidate("owner", "2026-10-06", "2026-10-08")],
      [
        known("s1", "back", "2026-10-05", {
          status: "cancelled",
          cancelReason: "missing",
          cancelledAt: d("2026-09-29"),
        }),
        known("s2", "owner", "2026-10-08", {
          status: "cancelled",
          cancelReason: "owner",
          cancelledAt: d("2026-09-29"),
        }),
      ],
      context,
    );
    const back = plan.update.find((u) => u.id === "s1")!;
    expect(back.data).toMatchObject({ status: "confirmed", cancelReason: null, cancelledAt: null });
    const owner = plan.update.find((u) => u.id === "s2")!;
    expect(owner.data.status).toBeUndefined();
    expect(owner.data.cancelReason).toBeUndefined();
  });

  it("records a cancellation the channel sends explicitly", () => {
    const plan = planFeedSync(
      [candidate("a", "2026-10-02", "2026-10-05", "cancelled")],
      [known("s1", "a", "2026-10-05")],
      context,
    );
    expect(plan.update[0].data).toMatchObject({
      status: "cancelled",
      cancelReason: "channel",
      cancelledAt: NOW,
    });
    expect(plan.cancel).toEqual([]);
  });
});
