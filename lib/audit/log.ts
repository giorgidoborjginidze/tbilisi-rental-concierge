// The audit trail (ჟურნალირება).
//
// Georgian personal-data law requires an automated system to record what was
// done to personal data — collected, read, changed, disclosed, erased — and
// by whom; ISO 27001 A.8.15 asks for the same events so an incident can be
// reconstructed. One helper writes them all, and it is deliberately
// forgiving: a failure to log must never take a user-facing action down with
// it, because a half-applied change is worse than a missing log line.
//
// What never goes in: the personal data itself. A trail that copies a phone
// number doubles the exposure it exists to document, so `detail` carries
// counts, record types and reasons — nothing a person can be identified from.

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { subjectRef, truncateIp } from "./redact";

export { subjectRef, truncateIp } from "./redact";

export const AUDIT_ACTIONS = [
  "register",
  "login",
  "login_failed",
  "login_locked",
  "logout",
  "password_verify_failed",
  "data_export",
  "account_erased",
  "record_erased",
  "team_member_removed",
  "invite_created",
  "retention_sweep",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The caller's truncated address, when a request context is available. */
export async function requestIp(): Promise<string | null> {
  try {
    const store = await headers();
    return truncateIp(
      store.get("x-forwarded-for") ?? store.get("x-real-ip") ?? null,
    );
  } catch {
    // Called outside a request (the scheduler, a test) — no address to log.
    return null;
  }
}

export interface AuditInput {
  action: AuditAction;
  actorId?: string | null;
  /** Email of the acting person; stored only as its pseudonymous ref. */
  actorEmail?: string | null;
  entity?: string | null;
  entityId?: string | null;
  detail?: Record<string, unknown> | null;
  /** Pre-truncated address; omitted means "read it from the request". */
  ip?: string | null;
}

/**
 * Write one line to the trail. Never throws: the caller's action has
 * already happened, and losing the log entry must not undo it. A failure
 * goes to stderr so it still surfaces in the platform's own logs.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorRef: input.actorEmail ? subjectRef(input.actorEmail) : null,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        detail: (input.detail ?? undefined) as never,
        ip: input.ip !== undefined ? input.ip : await requestIp(),
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", input.action, error);
  }
}
