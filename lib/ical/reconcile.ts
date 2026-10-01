// What one successful fetch of a feed changes — pure, no I/O.
//
// A channel feed is the channel's current truth about a unit. So after a
// good fetch:
//   * a stay in the feed that we do not know yet is created;
//   * a stay we know is updated when the feed changed it (dates, status,
//     the feed it comes from) — except that a stay the owner cancelled in
//     Activo stays cancelled. A stay the feed repeats unchanged is left
//     alone, so a sync reports (and writes) only what changed;
//   * a stay we imported from this feed that is no longer in it, and has
//     not ended yet, is cancelled: Airbnb and Booking.com drop a cancelled
//     reservation from the export instead of marking it CANCELLED. Stays
//     that already ended are left alone (feeds drop old stays too).
//
// A failed fetch changes nothing (run-sync never calls this then).

import type { BookingCandidate } from "./sync";

export interface KnownStay {
  id: string;
  externalId: string | null;
  feedId: string | null;
  status: string;
  cancelReason: string | null;
  cancelledAt: Date | null;
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

export interface StayUpdate {
  id: string;
  data: {
    checkIn: Date;
    checkOut: Date;
    nights: number;
    feedId: string;
    status?: string;
    cancelledAt?: Date | null;
    cancelReason?: string | null;
  };
}

export interface FeedPlan {
  create: BookingCandidate[];
  update: StayUpdate[];
  /** Ids of stays that vanished from the feed — to be cancelled. */
  cancel: string[];
  /**
   * The feed came back with no event at all while it still had future
   * stays: held back as suspect (a channel glitch) — nothing is cancelled
   * until a second fetch in a row is empty too.
   */
  suspectEmpty?: boolean;
}

export interface PlanContext {
  feedId: string;
  /**
   * Stays imported before feeds were tracked (feedId null) count as this
   * feed's — true when it is the unit's only feed of that channel.
   */
  ownsLegacy: boolean;
  now: Date;
  /** The previous fetch of this feed was empty too (it was held back then). */
  emptyBefore?: boolean;
}

const sameTime = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Does applying `data` change anything on the stored stay? */
function changes(stay: KnownStay, data: StayUpdate["data"]): boolean {
  if (!sameTime(stay.checkIn, data.checkIn) || !sameTime(stay.checkOut, data.checkOut)) return true;
  if (stay.nights !== data.nights || stay.feedId !== data.feedId) return true;
  if (data.status !== undefined && data.status !== stay.status) return true;
  if (data.cancelReason !== undefined && data.cancelReason !== stay.cancelReason) return true;
  if (data.cancelledAt !== undefined && !sameTime(data.cancelledAt, stay.cancelledAt)) return true;
  return false;
}

/**
 * `known` holds the unit's stays of the feed's channel that carry an
 * externalId (every feed's, not only this one's — matching is by the
 * reservation's UID, which the channel keeps stable).
 */
export function planFeedSync(
  candidates: BookingCandidate[],
  known: KnownStay[],
  context: PlanContext,
): FeedPlan {
  const byExternalId = new Map(
    known.filter((stay) => stay.externalId).map((stay) => [stay.externalId as string, stay]),
  );
  // One event per UID; a repeated UID keeps its last occurrence.
  const inFeed = new Map(candidates.map((candidate) => [candidate.externalId, candidate]));

  const plan: FeedPlan = { create: [], update: [], cancel: [] };
  for (const candidate of inFeed.values()) {
    const stay = byExternalId.get(candidate.externalId);
    if (!stay) {
      plan.create.push(candidate);
      continue;
    }
    const data: StayUpdate["data"] = {
      checkIn: candidate.checkIn,
      checkOut: candidate.checkOut,
      nights: candidate.nights,
      feedId: context.feedId,
    };
    if (stay.cancelReason === "owner") {
      // The owner cancelled it in Activo: the feed does not revive it.
    } else if (candidate.status === "cancelled") {
      data.status = "cancelled";
      data.cancelReason = "channel";
      data.cancelledAt = stay.status === "cancelled" && stay.cancelledAt ? stay.cancelledAt : context.now;
    } else {
      // Back in the feed (or never gone): it stands.
      data.status = candidate.status;
      data.cancelledAt = null;
      data.cancelReason = null;
    }
    if (changes(stay, data)) plan.update.push({ id: stay.id, data });
  }

  for (const stay of known) {
    if (!stay.externalId || inFeed.has(stay.externalId)) continue;
    if (stay.status === "cancelled") continue;
    if (stay.checkOut.getTime() <= context.now.getTime()) continue;
    const ours = stay.feedId === context.feedId || (stay.feedId == null && context.ownsLegacy);
    if (ours) plan.cancel.push(stay.id);
  }
  // An empty calendar that would wipe every future stay is more likely a
  // glitch than every guest cancelling at once: wait for a second empty
  // fetch before believing it.
  if (inFeed.size === 0 && plan.cancel.length > 0 && !context.emptyBefore) {
    return { ...plan, cancel: [], suspectEmpty: true };
  }
  return plan;
}
