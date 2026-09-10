// Retention policy as data: how long each kind of row may live, and the
// arithmetic that turns that into a cut-off date. No database here, so the
// policy is testable and can be quoted verbatim in the compliance record.

const days = (name: string, fallback: number): number => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

export interface RetentionWindows {
  /** Location history. Short on purpose: it is the most intrusive row here. */
  geoEventDays: number;
  /** Sent/failed WhatsApp messages, kept as proof a warning went out. */
  notifyMessageDays: number;
  /** Audit trail. Long enough to investigate, not indefinite. */
  auditLogDays: number;
  /** Closed brute-force counters. */
  loginAttemptDays: number;
  /**
   * Closed alerts. An overdue-rent or geofence-breach alert carries the
   * tenant's name, phone and a coordinate in its payload, so a settled one
   * is personal data with no remaining purpose.
   */
  closedAlertDays: number;
}

/**
 * The windows in force. An unset, empty, zero or negative override falls
 * back to the documented default — the two ways to get that wrong are
 * "delete everything" and "keep for ever", and both are worse than the
 * number this file already agreed on.
 */
export function retentionWindows(): RetentionWindows {
  return {
    geoEventDays: days("RETENTION_GEO_EVENT_DAYS", 90),
    notifyMessageDays: days("RETENTION_NOTIFY_MESSAGE_DAYS", 180),
    auditLogDays: days("RETENTION_AUDIT_LOG_DAYS", 730),
    loginAttemptDays: days("RETENTION_LOGIN_ATTEMPT_DAYS", 30),
    closedAlertDays: days("RETENTION_CLOSED_ALERT_DAYS", 365),
  };
}

/** Cut-off date for a window of `n` days before `now`. */
export function cutoff(now: Date, n: number): Date {
  return new Date(now.getTime() - n * 86_400_000);
}
