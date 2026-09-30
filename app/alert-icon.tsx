import type { Severity } from "@/lib/ui/tone";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconClock,
  IconFlag,
  IconInfo,
  IconSignalOff,
  IconTrendUp,
} from "./icons";

// The line icon of an alert type (alert cards, market advice tiles) and of
// a plain notice's severity. No hooks — usable from server and client.

const BY_TYPE: Record<string, (props: { size?: number }) => React.ReactElement> = {
  overlap: IconAlert,
  repossession_right: IconAlert,
  geofence_breach: IconFlag,
  tracker_silent: IconSignalOff,
  rent_overdue: IconClock,
  contract_expiry: IconClock,
  lease_expiry: IconClock,
  contract_ended: IconCalendar,
  vacancy_gap: IconCalendar,
  underpriced: IconTrendUp,
};

const BY_SEVERITY: Record<Severity, (props: { size?: number }) => React.ReactElement> = {
  danger: IconAlert,
  warn: IconAlert,
  info: IconInfo,
  good: IconCheck,
  muted: IconInfo,
};

export function AlertTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const Icon = BY_TYPE[type] ?? IconInfo;
  return (
    <span className="alert-card__icon">
      <Icon size={size} />
    </span>
  );
}

export function SeverityIcon({ severity, size = 18 }: { severity: Severity; size?: number }) {
  const Icon = BY_SEVERITY[severity];
  return (
    <span className="alert-card__icon">
      <Icon size={size} />
    </span>
  );
}

/** Just the glyph of an alert type, for a tile that frames it itself. */
export function alertGlyph(type: string, size = 18) {
  const Icon = BY_TYPE[type] ?? IconInfo;
  return <Icon size={size} />;
}

/**
 * A titleless notice card: severity tint, stripe and icon, then the text.
 * `role` is "status" for news, "alert" for a failure, "note" otherwise.
 */
export function Notice({
  severity,
  children,
  role,
  style,
}: {
  severity: Severity;
  children: React.ReactNode;
  role?: "status" | "alert" | "note";
  style?: React.CSSProperties;
}) {
  return (
    <div className={`alert-card alert-card--${severity}`} role={role} style={style}>
      <div className="alert-card__notice">
        <SeverityIcon severity={severity} />
        <div>{children}</div>
      </div>
    </div>
  );
}
