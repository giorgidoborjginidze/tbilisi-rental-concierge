// The workspace's activity log: one line per change that matters — who
// (the person, also inside a team), what, on which thing, when. Writing a
// line never fails the change itself: an error is logged and the action
// goes on.

import { prisma } from "@/lib/db";

export const ACTIVITY_ACTIONS = [
  "asset.create", "asset.update", "asset.delete",
  "contract.create", "contract.update", "contract.delete", "contract.restore",
  "payment.record", "payment.delete",
  "unit.create", "unit.update", "unit.delete",
  "booking.create", "booking.update", "booking.cancel",
  "invoice.issue", "invoice.paid", "invoice.unpaid", "invoice.void",
  "file.upload", "file.delete",
  "team.invite", "team.role", "team.remove",
  "whatsapp.connect", "whatsapp.disconnect",
  "settings.payment", "settings.alert_phone", "settings.invoice_issuer",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Lines are kept this long. */
export const ACTIVITY_RETENTION_MS = 365 * 86_400_000;

export interface Actor {
  /** The workspace. */
  id: string;
  /** The person. */
  userId: string;
  name: string | null;
  email: string;
}

export async function logActivity(
  actor: Actor,
  action: ActivityAction,
  target?: { type?: string; id?: string | null; label?: string | null },
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        operatorId: actor.id,
        actorId: actor.userId,
        actorName: (actor.name?.trim() || actor.email).slice(0, 120),
        action,
        targetType: target?.type ?? action.split(".")[0],
        targetId: target?.id ?? null,
        label: target?.label ? target.label.slice(0, 200) : null,
      },
    });
  } catch (error) {
    console.error(`[activity] could not record ${action}:`, error instanceof Error ? error.message : error);
  }
}
