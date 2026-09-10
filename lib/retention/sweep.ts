// Retention: the part of data protection that is nobody's favourite and is
// therefore always the part that is missing.
//
// Both GDPR and Georgian law say personal data may be kept only as long as
// the purpose needs it. In this app four kinds of row keep accumulating
// long after their purpose is spent:
//
//   Session       expired cookies nobody can use any more
//   GeoEvent      where a named driver's car was, months ago
//   NotifyMessage a phone number plus the text that was sent to it
//   LoginAttempt  a failure counter whose window closed
//   Alert         a settled overdue-rent or breach alert, whose payload
//                 still names a tenant and where their car was
//   AuditLog      the trail itself, which the law wants kept — but not
//                 forever
//
// Windows are policy, not physics, so each one is an environment variable
// with a stated default. Changing a number here is a controller decision
// and should be recorded as one.

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit/log";
import { cutoff, retentionWindows } from "./windows";

export * from "./windows";

export interface SweepResult {
  sessions: number;
  geoEvents: number;
  notifyMessages: number;
  auditLogs: number;
  loginAttempts: number;
  closedAlerts: number;
}

/**
 * Delete everything past its window. Safe to run as often as you like —
 * it is idempotent by construction, since a row either is or is not older
 * than the cut-off.
 */
export async function sweepRetention(
  now = new Date(),
  windows = retentionWindows(),
): Promise<SweepResult> {
  const [
    sessions, geoEvents, notifyMessages, auditLogs, loginAttempts, closedAlerts,
  ] = await Promise.all([
      // An expired session is dead weight the moment it expires.
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.geoEvent.deleteMany({
        where: { createdAt: { lt: cutoff(now, windows.geoEventDays) } },
      }),
      // Anything still queued is an event nobody has been told about yet;
      // only settled messages age out.
      prisma.notifyMessage.deleteMany({
        where: {
          status: { in: ["sent", "failed"] },
          createdAt: { lt: cutoff(now, windows.notifyMessageDays) },
        },
      }),
      prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff(now, windows.auditLogDays) } },
      }),
      prisma.loginAttempt.deleteMany({
        where: { lastAt: { lt: cutoff(now, windows.loginAttemptDays) } },
      }),
      // Only settled ones. An open alert is still doing its job, however
      // old it is — and an old open alert is usually the important one.
      prisma.alert.deleteMany({
        where: {
          status: { in: ["dismissed", "resolved"] },
          createdAt: { lt: cutoff(now, windows.closedAlertDays) },
        },
      }),
    ]);

  const result: SweepResult = {
    sessions: sessions.count,
    geoEvents: geoEvents.count,
    notifyMessages: notifyMessages.count,
    auditLogs: auditLogs.count,
    loginAttempts: loginAttempts.count,
    closedAlerts: closedAlerts.count,
  };

  // The sweep is itself processing, and deletion is exactly the kind of
  // action the trail is required to carry.
  const total = Object.values(result).reduce((sum, n) => sum + n, 0);
  if (total > 0) {
    await recordAudit({
      action: "retention_sweep",
      ip: null,
      detail: { ...result, windows } as unknown as Record<string, unknown>,
    });
  }

  return result;
}
