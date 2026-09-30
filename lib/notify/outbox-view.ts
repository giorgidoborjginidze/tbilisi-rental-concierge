// The workspace-wide outbox (/alerts?tab=outbox): what still has to go out,
// across every asset, and what was handled lately. Pure.

export interface OutboxRow {
  status: string;
  toRole: string;
  createdAt: Date;
  sentAt: Date | null;
  cancelledAt: Date | null;
  /** Set when a queued/failed message no longer applies (lib/rentals/settle). */
  stale: string | null;
}

const RECENT_MS = 7 * 86_400_000;
/** Statuses of a message that has not gone out yet. */
export const PENDING_STATUSES: ReadonlySet<string> = new Set(["queued", "failed", "sending"]);
const PENDING = PENDING_STATUSES;

/** Sent by hand, a note to the owner would go to the owner's own number. */
export const selfAddressed = (row: { toRole: string }, autoSend: boolean) =>
  !autoSend && row.toRole === "owner";

/**
 * May this row be sent by hand (the wa.me link and "mark sent")? A failed
 * message, or a queued one while sending is manual — never a note to the
 * owner, whatever the mode: the link would open the owner's WhatsApp on the
 * owner's own number. Those only go out automatically.
 */
export const manualSendable = (
  row: { toRole: string; status: string; stale?: string | null },
  autoSend: boolean,
) =>
  row.toRole !== "owner" &&
  !row.stale &&
  (row.status === "failed" || (row.status === "queued" && !autoSend));

export function outboxView<T extends OutboxRow>(
  rows: T[],
  autoSend: boolean,
  now: Date,
): { waiting: T[]; hiddenOwner: number; recent: T[] } {
  const pending = rows.filter((row) => PENDING.has(row.status) && !row.stale);
  // Sent by hand, a note to the owner would go from the owner's WhatsApp to
  // the owner's own number — the alert already tells them. Only automatic
  // sending delivers those.
  const toOwner = (row: T) => selfAddressed(row, autoSend);
  const waiting = pending
    .filter((row) => !toOwner(row))
    // Oldest first: the order they are due to go out.
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const handledAt = (row: T) => row.sentAt ?? row.cancelledAt ?? row.createdAt;
  const recent = rows
    .filter(
      (row) =>
        (!PENDING.has(row.status) || row.stale) &&
        now.getTime() - handledAt(row).getTime() <= RECENT_MS,
    )
    .sort((a, b) => handledAt(b).getTime() - handledAt(a).getTime());
  return { waiting, hiddenOwner: pending.filter(toOwner).length, recent };
}
