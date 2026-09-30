// The order alerts are read in: what costs money or the car today first,
// advice last. /alerts lists them in this order, and the dashboard's
// Market Advice shows the top three — so a double booking or the
// repossession right is never pushed out by three "free window" tips.

export const ALERT_SEVERITY: Record<string, number> = {
  overlap: 0,
  repossession_right: 1,
  geofence_breach: 1,
  tracker_silent: 2,
  rent_overdue: 3,
  contract_ended: 4,
  contract_expiry: 5,
  lease_expiry: 5,
  vacancy_gap: 6,
  underpriced: 7,
};

const severity = (type: string) => ALERT_SEVERITY[type] ?? 8;

/** Most severe first; among equals the newest first. */
export function rankAlerts<T extends { type: string; createdAt: Date }>(alerts: T[]): T[] {
  return [...alerts].sort(
    (a, b) => severity(a.type) - severity(b.type) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
