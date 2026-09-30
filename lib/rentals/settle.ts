// Once what a message or an alert says stops being true, it is withdrawn.
//
// A tenant who has paid must not be told they are late; a driver whose
// contract was changed must not get a reminder quoting the old amount; a
// car that came back inside the red line must not trigger a "suspected
// theft" text. So:
//
//   - still-queued (or failed) messages are CANCELLED — kept, with the
//     reason, so the owner sees in the outbox why they will not go out,
//     and so the dedupe key still stops the same message being queued
//     again for a situation that is over;
//   - the matching open alerts are RESOLVED, and marked `autoResolved` in
//     their payload so an undo (or the next scan, if the situation comes
//     back) can reopen them — an alert the owner closed by hand is never
//     reopened.
//
// If the situation does come back (a payment is undone, a date restated),
// the next scan re-queues the reminder: queueMessage revives a cancelled
// message with a freshly rendered body instead of skipping it.

import type { PrismaClient } from "../../app/generated/prisma/client";
import { PAYMENT_TEMPLATES, type TemplateKey } from "../notify/templates";
import { dayKey } from "../time";
import { contractPhase } from "./phase";
import { hasBalance, statusFor, type ContractTermsInput, type DailyPricing } from "./terms";

export type WithdrawReason =
  | "paid"
  | "changed"
  | "contract_ended"
  | "contract_deleted"
  | "returned"
  | "moved_away"
  | "signal_back"
  | "superseded"
  // A later daily nudge about the same due date quotes today's figures.
  | "newer_reminder"
  // Red lines: the fence was deleted or switched off, or its asset deleted.
  | "fence_removed"
  | "fence_off"
  | "asset_deleted"
  // The per-recipient daily limit was reached.
  | "limit"
  // Calendar alerts: the free window got booked, its dates are over, the
  // double booking no longer exists, or the grace period ran out and a
  // repossession-right alert took over.
  | "filled"
  | "passed"
  | "replaced"
  | "overlap_cleared"
  | "escalated";

export const WITHDRAW_REASONS: WithdrawReason[] = [
  "paid",
  "changed",
  "contract_ended",
  "contract_deleted",
  "returned",
  "moved_away",
  "signal_back",
  "superseded",
  "newer_reminder",
  "fence_removed",
  "fence_off",
  "asset_deleted",
  "limit",
  "filled",
  "passed",
  "replaced",
  "overlap_cleared",
  "escalated",
];

/** Late-rent alerts; each carries payload.contractId and payload.dueDate. */
export const RENT_ALERTS = ["rent_overdue", "repossession_right"];

/** Every payment-schedule template, vehicle and property wording alike. */
export const PAYMENT_KINDS: TemplateKey[] = Object.values(PAYMENT_TEMPLATES).flatMap(
  (keys) => Object.values(keys) as TemplateKey[],
);

export const GEO_KINDS: TemplateKey[] = [
  "geo_approach_driver",
  "geo_approach_owner",
  "geo_breach_driver",
  "geo_breach_owner",
];

/** Messages that may still go out. */
const UNSENT = ["queued", "failed"];

/** Due date ("YYYY-MM-DD") a payment reminder's dedupe key refers to. */
export function dueDateOfDedupeKey(dedupeKey: string): string | null {
  const match = /^pay\|[^|]+\|(\d{4}-\d{2}-\d{2})\|/.exec(dedupeKey);
  return match ? match[1] : null;
}

/**
 * Which daily nudge a payment reminder is: "due" (the due day itself),
 * "late" with its day count, or null for the once-only messages.
 */
export function nudgeOfDedupeKey(
  dedupeKey: string,
): { kind: "due" } | { kind: "late"; days: number } | null {
  const match = /^pay\|[^|]+\|\d{4}-\d{2}-\d{2}\|(due|late(\d+))$/.exec(dedupeKey);
  if (!match) return null;
  return match[1] === "due" ? { kind: "due" } : { kind: "late", days: Number(match[2]) };
}

const DAY_MS = 86_400_000;

/** The GeoEvent id a red-line message's dedupe key refers to. */
export function geoEventOfDedupeKey(dedupeKey: string): string | null {
  const match = /^geo\|([^|]+)\|/.exec(dedupeKey);
  return match ? match[1] : null;
}

export interface ContractForStaleness {
  startDate: Date;
  endDate: Date;
  paidThrough: Date | null;
  remindersEnabled?: boolean;
}

/**
 * Should this unsent payment reminder be withdrawn — and why? Pure, so the
 * rental page (which must not offer a stale "send on WhatsApp" link), the
 * sweep before every send and the tests all share it.
 */
export function stalePaymentMessage(
  message: { dedupeKey: string; kind: string; toRole?: string },
  contract: ContractForStaleness | null,
  today: Date,
): WithdrawReason | null {
  if (!PAYMENT_KINDS.includes(message.kind as TemplateKey)) return null;
  if (!contract) return "contract_deleted";
  if (contractPhase(contract, today) === "ended") return "contract_ended";
  const due = dueDateOfDedupeKey(message.dedupeKey);
  if (due && contract.paidThrough && due < dayKey(contract.paidThrough)) return "paid";
  // Reminders switched off: the renter hears nothing more (the owner's own
  // copy is still useful to them).
  if (contract.remindersEnabled === false && message.toRole !== "owner") return "changed";
  // Yesterday's "1 day late, 60 GEL" must not go out on day 3, when every
  // screen and today's nudge say "3 days, 180 GEL": a daily nudge holds
  // only on the day it counts.
  const nudge = nudgeOfDedupeKey(message.dedupeKey);
  if (due && nudge) {
    const daysLate = Math.round(
      (Date.parse(`${dayKey(today)}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / DAY_MS,
    );
    if (daysLate > (nudge.kind === "due" ? 0 : nudge.days)) return "newer_reminder";
  }
  return null;
}

/**
 * Should this unsent red-line message be withdrawn? It is stale once the
 * vehicle has come back inside that fence after the event it announces —
 * and once the fence itself is gone (deleted with its events, or with its
 * asset) or switched off: a "suspected theft" text about a line the owner
 * no longer draws must never go out.
 */
export function staleGeoMessage(
  message: { dedupeKey: string; kind: string },
  event: { createdAt: Date; fenceActive?: boolean } | null,
  lastReturnAt: Date | null,
): WithdrawReason | null {
  if (!GEO_KINDS.includes(message.kind as TemplateKey)) return null;
  if (!event) return "fence_removed";
  if (event.fenceActive === false) return "fence_off";
  return lastReturnAt && lastReturnAt >= event.createdAt ? "returned" : null;
}

const markCancelled = (reason: WithdrawReason, now: Date) => ({
  status: "cancelled",
  cancelReason: reason,
  cancelledAt: now,
});

async function cancelMessages(
  db: PrismaClient,
  ids: string[],
  reason: WithdrawReason,
  now: Date,
): Promise<number> {
  if (ids.length === 0) return 0;
  return (
    await db.notifyMessage.updateMany({
      where: { id: { in: ids }, status: { in: UNSENT } },
      data: markCancelled(reason, now),
    })
  ).count;
}

type AlertRow = { id: string; payload: unknown };

/** Resolve alerts on the system's behalf, remembering why. */
async function autoResolve(
  db: PrismaClient,
  alerts: AlertRow[],
  reason: WithdrawReason,
  now: Date,
): Promise<number> {
  for (const alert of alerts) {
    await db.alert.update({
      where: { id: alert.id },
      data: {
        status: "resolved",
        resolvedAt: now,
        payload: { ...(alert.payload as object), autoResolved: reason },
      },
    });
  }
  return alerts.length;
}

/**
 * Close alerts on the system's behalf (the scan's calendar alerts use it):
 * they carry `autoResolved`, so the scan reopens one whose condition comes
 * back — never one the owner closed.
 */
export async function resolveAlerts(
  db: PrismaClient,
  alerts: AlertRow[],
  reason: WithdrawReason,
  now: Date = new Date(),
): Promise<number> {
  return autoResolve(db, alerts, reason, now);
}

const contractIdOf = (payload: unknown) =>
  (payload as { contractId?: string } | null)?.contractId;
const dueDateOf = (payload: unknown) =>
  (payload as { dueDate?: string } | null)?.dueDate;

export interface SettleResult {
  resolved: number;
  cancelled: number;
}

export interface SettleOptions {
  /** Why the rent position changed: money in, or new terms. */
  cause?: "paid" | "changed";
  /**
   * The owner just changed the position (a payment, new terms): reminders
   * about periods still owed quote an amount that is no longer right, so
   * they are withdrawn too and the next scan writes fresh ones. The
   * deploy-time repair leaves them alone — it only clears what is paid.
   */
  withdrawOwed?: boolean;
}

/**
 * The rent position of a contract has changed. Its late-rent alerts for
 * due dates that are now paid are resolved and the unsent reminders about
 * them withdrawn — with `withdrawOwed`, every unsent reminder is.
 */
export async function settlePaidRent(
  db: PrismaClient,
  contractId: string,
  paidThrough: Date | null,
  now: Date = new Date(),
  { cause = "paid", withdrawOwed = false }: SettleOptions = {},
): Promise<SettleResult> {
  const paidKey = paidThrough ? dayKey(paidThrough) : null;

  const alerts = await db.alert.findMany({
    where: { type: { in: RENT_ALERTS }, status: "open" },
    select: { id: true, payload: true },
  });
  const paidAlerts = alerts.filter((alert) => {
    const due = dueDateOf(alert.payload);
    return contractIdOf(alert.payload) === contractId && !!due && !!paidKey && due < paidKey;
  });
  const resolved = await autoResolve(db, paidAlerts, cause, now);

  const messages = await db.notifyMessage.findMany({
    where: { contractId, status: { in: UNSENT }, kind: { in: PAYMENT_KINDS } },
    select: { id: true, dedupeKey: true },
  });
  const settled: string[] = [];
  const changed: string[] = [];
  for (const message of messages) {
    const due = dueDateOfDedupeKey(message.dedupeKey);
    if (due && paidKey && due < paidKey) settled.push(message.id);
    else if (withdrawOwed) changed.push(message.id);
  }
  const cancelled =
    (await cancelMessages(db, settled, cause, now)) +
    (await cancelMessages(db, changed, "changed", now));

  return { resolved, cancelled };
}

/**
 * A contract is gone or over: nothing more goes out about it, and its
 * open alerts — late rent, repossession right, expiry — are closed.
 */
export async function withdrawContract(
  db: PrismaClient,
  contractId: string,
  reason: "contract_ended" | "contract_deleted",
  now: Date = new Date(),
): Promise<SettleResult> {
  const messages = await db.notifyMessage.findMany({
    where: { contractId, status: { in: UNSENT } },
    select: { id: true },
  });
  const cancelled = await cancelMessages(
    db,
    messages.map((message) => message.id),
    reason,
    now,
  );

  const types =
    reason === "contract_deleted"
      ? [...RENT_ALERTS, "contract_expiry", "contract_ended"]
      : RENT_ALERTS;
  const alerts = await db.alert.findMany({
    where: { type: { in: types }, status: "open" },
    select: { id: true, payload: true },
  });
  const resolved = await autoResolve(
    db,
    alerts.filter((alert) => contractIdOf(alert.payload) === contractId),
    reason,
    now,
  );
  return { resolved, cancelled };
}

/**
 * A payment was removed: what exactly that payment withdrew comes back, as
 * long as the due date it is about is unpaid again. `since` is when the
 * payment was recorded — settlePaidRent stamps what it withdraws with that
 * very time, so rows withdrawn later (by another payment, a restated
 * balance, the sweep) are left alone.
 *
 * Only the immediate undo re-queues the withdrawn reminders: they were
 * written minutes ago and still quote the right figures. Deleting an older
 * payment only reopens the alerts; the next scan writes fresh reminders
 * (queueMessage revives a withdrawn one with a newly rendered body).
 */
export async function restoreAfterUndo(
  db: PrismaClient,
  contractId: string,
  paidThrough: Date | null,
  since: Date,
  { requeue = false }: { requeue?: boolean } = {},
): Promise<{ reopened: number; requeued: number }> {
  const paidKey = paidThrough ? dayKey(paidThrough) : "";

  const alerts = await db.alert.findMany({
    where: { type: { in: RENT_ALERTS }, status: "resolved", resolvedAt: since },
    select: { id: true, payload: true },
  });
  let reopened = 0;
  for (const alert of alerts) {
    const payload = alert.payload as { autoResolved?: string; dueDate?: string; contractId?: string };
    if (payload.contractId !== contractId) continue;
    if (payload.autoResolved !== "paid" && payload.autoResolved !== "changed") continue;
    if (!payload.dueDate || payload.dueDate < paidKey) continue;
    const { autoResolved: _dropped, ...rest } = payload;
    void _dropped;
    await db.alert.update({
      where: { id: alert.id },
      data: { status: "open", resolvedAt: null, payload: rest },
    });
    reopened += 1;
  }

  if (!requeue) return { reopened, requeued: 0 };

  const messages = await db.notifyMessage.findMany({
    where: {
      contractId,
      status: "cancelled",
      cancelReason: { in: ["paid", "changed"] },
      cancelledAt: since,
    },
    select: { id: true, dedupeKey: true },
  });
  const ids = messages
    .filter((message) => {
      const due = dueDateOfDedupeKey(message.dedupeKey);
      return due != null && due >= paidKey;
    })
    .map((message) => message.id);
  const requeued = ids.length
    ? (
        await db.notifyMessage.updateMany({
          where: { id: { in: ids } },
          data: { status: "queued", cancelReason: null, cancelledAt: null, error: null },
        })
      ).count
    : 0;

  return { reopened, requeued };
}

/**
 * The vehicle is back inside a red line ("returned"), or back in the safe
 * zone after nearing it ("moved_away"): the warnings still waiting about
 * that fence are withdrawn — the approach and breach texts on a return,
 * the approach text on moving away — and its breach alerts are closed.
 */
export async function withdrawFence(
  db: PrismaClient,
  fenceId: string,
  returnedAt: Date,
  now: Date = new Date(),
  reason: "returned" | "moved_away" = "returned",
): Promise<SettleResult> {
  const kinds = reason === "returned" ? ["approach", "breach"] : ["approach"];
  const events = await db.geoEvent.findMany({
    where: { geofenceId: fenceId, kind: { in: kinds }, createdAt: { lte: returnedAt } },
    select: { id: true },
  });
  if (events.length === 0) return { resolved: 0, cancelled: 0 };
  const eventIds = events.map((event) => event.id);

  const messages = await db.notifyMessage.findMany({
    where: {
      status: { in: UNSENT },
      kind: { in: GEO_KINDS },
      dedupeKey: { in: eventIds.flatMap((id) => [`geo|${id}|driver`, `geo|${id}|owner`]) },
    },
    select: { id: true },
  });
  const cancelled = await cancelMessages(
    db,
    messages.map((message) => message.id),
    reason,
    now,
  );

  const idSet = new Set(eventIds);
  const alerts = await db.alert.findMany({
    where: { type: "geofence_breach", status: "open" },
    select: { id: true, payload: true },
  });
  const resolved = await autoResolve(
    db,
    alerts.filter((alert) => idSet.has((alert.payload as { key?: string }).key ?? "")),
    reason,
    now,
  );
  return { resolved, cancelled };
}

/** The tracker is sending again: its open "tracker silent" alerts close. */
export async function resolveTrackerSilence(
  db: PrismaClient,
  operatorId: string,
  assetId: string,
  now: Date = new Date(),
): Promise<number> {
  const alerts = await db.alert.findMany({
    where: { operatorId, type: "tracker_silent", status: "open" },
    select: { id: true, payload: true },
  });
  return autoResolve(
    db,
    alerts.filter((alert) => (alert.payload as { assetId?: string } | null)?.assetId === assetId),
    "signal_back",
    now,
  );
}

/**
 * "Contract ended" alerts that no longer stand — a later stay on the same
 * asset ended, or a new contract now follows — are closed.
 */
export async function closeSupersededEndings(
  db: PrismaClient,
  alerts: AlertRow[],
  now: Date = new Date(),
): Promise<number> {
  return autoResolve(db, alerts, "superseded", now);
}

/**
 * Last check before anything is sent (and at every scan): withdraw each
 * unsent message whose situation is over — the rent it chases is paid, its
 * contract ended or was deleted, the vehicle came back inside the line.
 */
export async function sweepStaleMessages(
  db: PrismaClient,
  today: Date,
  operatorId?: string,
  now: Date = new Date(),
): Promise<number> {
  const messages = await db.notifyMessage.findMany({
    where: {
      status: { in: UNSENT },
      kind: { in: [...PAYMENT_KINDS, ...GEO_KINDS] },
      ...(operatorId ? { operatorId } : {}),
    },
    select: { id: true, dedupeKey: true, kind: true, toRole: true, contractId: true },
  });
  if (messages.length === 0) return 0;

  const contractIds = [
    ...new Set(messages.map((message) => message.contractId).filter(Boolean)),
  ] as string[];
  const contracts = new Map(
    (
      await db.rentalContract.findMany({
        where: { id: { in: contractIds } },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          paidThrough: true,
          remindersEnabled: true,
        },
      })
    ).map((contract) => [contract.id, contract]),
  );

  const eventIds = messages
    .map((message) => geoEventOfDedupeKey(message.dedupeKey))
    .filter(Boolean) as string[];
  const events = new Map(
    (
      await db.geoEvent.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, geofenceId: true, createdAt: true, geofence: { select: { active: true } } },
      })
    ).map((event) => [
      event.id,
      { ...event, fenceActive: event.geofence ? event.geofence.active : undefined },
    ]),
  );
  const fenceIds = [...new Set([...events.values()].map((event) => event.geofenceId))];
  const lastReturn = new Map<string, Date>();
  for (const row of await db.geoEvent.findMany({
    where: { geofenceId: { in: fenceIds }, kind: "return" },
    select: { geofenceId: true, createdAt: true },
  })) {
    const seen = lastReturn.get(row.geofenceId);
    if (!seen || row.createdAt > seen) lastReturn.set(row.geofenceId, row.createdAt);
  }

  const byReason = new Map<WithdrawReason, string[]>();
  for (const message of messages) {
    let reason: WithdrawReason | null;
    if (PAYMENT_KINDS.includes(message.kind as TemplateKey)) {
      // A payment message queued before contracts were linked has no id:
      // nothing to check it against, so it is left alone.
      if (!message.contractId) continue;
      reason = stalePaymentMessage(message, contracts.get(message.contractId) ?? null, today);
    } else {
      const eventId = geoEventOfDedupeKey(message.dedupeKey);
      const event = eventId ? events.get(eventId) ?? null : null;
      reason = staleGeoMessage(message, event, event ? lastReturn.get(event.geofenceId) ?? null : null);
    }
    if (!reason) continue;
    byReason.set(reason, [...(byReason.get(reason) ?? []), message.id]);
  }

  let cancelled = 0;
  for (const [reason, ids] of byReason) {
    cancelled += await cancelMessages(db, ids, reason, now);
  }
  return cancelled;
}

export interface RentAlertContract extends ContractTermsInput {
  graceDays: number;
  paidThrough: Date | null;
  creditBalance?: number | null;
  /** The asset's daily pricing, so a finished contract's debt is priced as every screen prices it. */
  asset?: DailyPricing | null;
}

/**
 * Should this open late-rent alert be closed — and why? Pure.
 *
 * The monitor only ever raises an alert for the contract's first unpaid due
 * date (= its paid-up-to date), so an alert for an earlier date is paid and
 * one for a later date belongs to an earlier schedule (the period or amount
 * was changed since). A contract that has ended keeps its alert while rent
 * is still owed under it: that debt must stay in sight even when the asset
 * went straight to the next renter.
 */
export function staleRentAlert(
  payload: unknown,
  contract: RentAlertContract | null,
  today: Date,
): WithdrawReason | null {
  if (!contract) return "contract_deleted";
  const due = dueDateOf(payload);
  if (due && contract.paidThrough) {
    if (due < dayKey(contract.paidThrough)) return "paid";
    // The first unpaid due date as the schedule now counts it.
    const next = dayKey(statusFor(contract, today, contract.asset ?? null).nextDueDate);
    if (due > next) return "changed";
  }
  if (contractPhase(contract, today) === "ended" && !hasBalance(contract, today, contract.asset ?? null)) {
    return "contract_ended";
  }
  return null;
}

/**
 * Late-rent alerts that no longer hold (staleRentAlert): the due date is
 * paid, the schedule it was about was changed, the contract was deleted,
 * or it has ended with nothing left to pay. Runs at every scan, and for a
 * single contract right after its terms are saved.
 */
export async function sweepStaleRentAlerts(
  db: PrismaClient,
  today: Date,
  scope: { operatorId?: string; contractId?: string } = {},
  now: Date = new Date(),
): Promise<number> {
  const alerts = (
    await db.alert.findMany({
      where: {
        type: { in: RENT_ALERTS },
        status: "open",
        ...(scope.operatorId ? { operatorId: scope.operatorId } : {}),
      },
      select: { id: true, payload: true },
    })
  ).filter((alert) => !scope.contractId || contractIdOf(alert.payload) === scope.contractId);
  if (alerts.length === 0) return 0;
  const ids = [...new Set(alerts.map((alert) => contractIdOf(alert.payload)).filter(Boolean))] as string[];
  const contracts = new Map(
    (
      await db.rentalContract.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          paidThrough: true,
          paymentPeriod: true,
          paymentAmount: true,
          monthlyRent: true,
          graceDays: true,
          creditBalance: true,
          asset: { select: { dailyRate: true, weekendPct: true, holidayPct: true } },
        },
      })
    ).map((contract) => [contract.id, contract]),
  );
  const byReason = new Map<WithdrawReason, AlertRow[]>();
  for (const alert of alerts) {
    const id = contractIdOf(alert.payload);
    if (!id) continue;
    const reason = staleRentAlert(alert.payload, contracts.get(id) ?? null, today);
    if (reason) byReason.set(reason, [...(byReason.get(reason) ?? []), alert]);
  }
  let resolved = 0;
  for (const [reason, rows] of byReason) {
    resolved += await autoResolve(db, rows, reason, now);
  }
  return resolved;
}

/**
 * A red line is being deleted or switched off (or its asset deleted): the
 * warnings still waiting to go out about it are withdrawn now, while its
 * events — which the dedupe keys point at — still exist.
 */
export async function withdrawFenceMessages(
  db: PrismaClient,
  fenceIds: string[],
  reason: "fence_removed" | "fence_off" | "asset_deleted",
  now: Date = new Date(),
): Promise<number> {
  if (fenceIds.length === 0) return 0;
  const events = await db.geoEvent.findMany({
    where: { geofenceId: { in: fenceIds } },
    select: { id: true },
  });
  if (events.length === 0) return 0;
  const messages = await db.notifyMessage.findMany({
    where: {
      status: { in: UNSENT },
      kind: { in: GEO_KINDS },
      dedupeKey: { in: events.flatMap((event) => [`geo|${event.id}|driver`, `geo|${event.id}|owner`]) },
    },
    select: { id: true },
  });
  return cancelMessages(
    db,
    messages.map((message) => message.id),
    reason,
    now,
  );
}

/**
 * An asset is being deleted: nothing more goes out about it, and the open
 * alerts that point at it (late rent, contract, red line, tracker) close.
 */
export async function withdrawAsset(
  db: PrismaClient,
  operatorId: string,
  assetId: string,
  now: Date = new Date(),
): Promise<SettleResult> {
  const messages = await db.notifyMessage.findMany({
    where: { operatorId, assetId, status: { in: UNSENT } },
    select: { id: true },
  });
  const cancelled = await cancelMessages(
    db,
    messages.map((message) => message.id),
    "asset_deleted",
    now,
  );
  const alerts = await db.alert.findMany({
    where: { operatorId, status: "open" },
    select: { id: true, payload: true },
  });
  const resolved = await autoResolve(
    db,
    alerts.filter((alert) => (alert.payload as { assetId?: string } | null)?.assetId === assetId),
    "asset_deleted",
    now,
  );
  return { resolved, cancelled };
}
