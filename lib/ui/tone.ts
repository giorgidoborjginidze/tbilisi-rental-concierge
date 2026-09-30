// One colour meaning everywhere — badges, alert cards, fence zones, the
// outbox, calculator verdicts and payment states all pick their colour
// here, so "green" never means "warning" on one screen and "fine" on the
// next. Pure, client-safe; the classes live in app/globals.css.
//
//   good    green  paid · safe · sent · active · a good deal
//   warn    amber  grace days · approaching · below market · needs a look
//   danger  red    repossession · outside the red line · overlap · failed
//   muted   grey   ended · paused · unknown · withdrawn
//   info    blue   plain information
//   listed  violet the asset's "listed" status — nothing else
//   tag     neutral PRO, symbols, recipients, buy/sell

export type Tone = "good" | "warn" | "danger" | "muted" | "info" | "listed" | "tag";

/** Badge class per tone. */
export const TONE_BADGE: Record<Tone, string> = {
  good: "badge--good",
  warn: "badge--warn",
  danger: "badge--danger",
  muted: "badge--muted",
  info: "badge--info",
  listed: "badge--listed",
  tag: "badge--tag",
};

export const badgeClass = (tone: Tone): string => `badge ${TONE_BADGE[tone]}`;

/** Alert-card class per severity (a tint, a 4 px stripe, an icon colour). */
export type Severity = "danger" | "warn" | "info" | "good" | "muted";

export const alertCardClass = (severity: Severity): string =>
  `alert-card alert-card--${severity}`;

/** How loud each alert type is. */
const ALERT_SEVERITY: Record<string, Severity> = {
  overlap: "danger",
  repossession_right: "danger",
  geofence_breach: "danger",
  rent_overdue: "warn",
  tracker_silent: "warn",
  contract_expiry: "warn",
  lease_expiry: "warn",
  underpriced: "warn",
  contract_ended: "info",
  vacancy_gap: "info",
};

export const alertSeverity = (type: string): Severity => ALERT_SEVERITY[type] ?? "info";

/** Calculator verdicts — the same three colours in every calculator. */
export type Verdict = "good" | "ok" | "poor";
export const VERDICT_TONE: Record<Verdict, Tone> = { good: "good", ok: "warn", poor: "danger" };
export const VERDICT_BADGE: Record<Verdict, string> = {
  good: badgeClass("good"),
  ok: badgeClass("warn"),
  poor: badgeClass("danger"),
};

/** A rental contract's payment state (lib/rentals/schedule ScheduleStatus.state). */
export const PAYMENT_TONE: Record<string, Tone> = {
  ok: "good",
  grace: "warn",
  overdue: "danger",
  repossess: "danger",
};

/** Where a tracked vehicle is against its red line. */
export const ZONE_TONE: Record<string, Tone> = {
  safe: "good",
  approach: "warn",
  outside: "danger",
  unknown: "muted",
};

/** A WhatsApp message in the outbox. */
export const OUTBOX_TONE: Record<string, Tone> = {
  sent: "good",
  queued: "info",
  sending: "info",
  failed: "danger",
  cancelled: "muted",
};

/** A subscription payment. */
export const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  approved: "good",
  declined: "danger",
  pending: "info",
};

/** Look up a tone, falling back to grey for anything unknown. */
export const toneOf = (map: Record<string, Tone>, key: string | null | undefined): Tone =>
  (key != null && map[key]) || "muted";
