// Once rent is paid, the alerts and unsent reminders about it are history.
// A "late" or "grace over" alert for a due date that is now paid is
// resolved, and a WhatsApp reminder about it that never went out is
// dropped — a tenant who has paid must not be told they are late.

import type { PrismaClient } from "../../app/generated/prisma/client";

const RENT_ALERTS = ["rent_overdue", "repossession_right"];

/** Due date ("YYYY-MM-DD") a payment reminder's dedupe key refers to. */
export function dueDateOfDedupeKey(dedupeKey: string): string | null {
  const match = /^pay\|[^|]+\|(\d{4}-\d{2}-\d{2})\|/.exec(dedupeKey);
  return match ? match[1] : null;
}

export async function settlePaidRent(
  db: PrismaClient,
  contractId: string,
  paidThrough: Date | null,
  now: Date = new Date(),
): Promise<{ resolved: number; removed: number }> {
  if (!paidThrough) return { resolved: 0, removed: 0 };
  const paidKey = paidThrough.toISOString().slice(0, 10);

  const alerts = await db.alert.findMany({
    where: { type: { in: RENT_ALERTS }, status: "open" },
    select: { id: true, payload: true },
  });
  const alertIds = alerts
    .filter((alert) => {
      const payload = alert.payload as { contractId?: string; dueDate?: string };
      return payload.contractId === contractId && !!payload.dueDate && payload.dueDate < paidKey;
    })
    .map((alert) => alert.id);
  const resolved = alertIds.length
    ? (
        await db.alert.updateMany({
          where: { id: { in: alertIds } },
          data: { status: "resolved", resolvedAt: now },
        })
      ).count
    : 0;

  const messages = await db.notifyMessage.findMany({
    where: { contractId, status: { in: ["queued", "failed"] } },
    select: { id: true, dedupeKey: true },
  });
  const messageIds = messages
    .filter((message) => {
      const due = dueDateOfDedupeKey(message.dedupeKey);
      return due != null && due < paidKey;
    })
    .map((message) => message.id);
  const removed = messageIds.length
    ? (await db.notifyMessage.deleteMany({ where: { id: { in: messageIds } } })).count
    : 0;

  return { resolved, removed };
}
