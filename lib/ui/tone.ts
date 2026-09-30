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

import type { PaymentState } from "@/lib/rentals/schedule";

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
  // Grey: the contract is over. app/alerts/page.tsx raises it to amber
  // when rent is still owed on it.
  contract_ended: "muted",
  vacancy_gap: "info",
};

export const alertSeverity = (type: string): Severity => ALERT_SEVERITY[type] ?? "info";

/**
 * An ended contract is grey — unless rent is still owed on it: then it
 * needs a look (amber), not the same weight as one that ended cleanly.
 */
export const endedAlertSeverity = (type: string, owesRent: boolean): Severity =>
  type === "contract_ended" && owesRent ? "warn" : alertSeverity(type);

/** Calculator verdicts — the same three colours in every calculator. */
export type Verdict = "good" | "ok" | "poor";
export const VERDICT_BADGE: Record<Verdict, string> = {
  good: badgeClass("good"),
  ok: badgeClass("warn"),
  poor: badgeClass("danger"),
};

/**
 * A rental contract's payment state (lib/rentals/schedule ScheduleStatus.state):
 * paid green, due/grace amber, repossession red, not started/ended grey.
 * Typed on PaymentState, so a new state cannot be left without a colour.
 */
export const PAYMENT_TONE: Record<PaymentState, Tone> = {
  not_started: "muted",
  ok: "good",
  due: "warn",
  grace: "warn",
  repossess: "danger",
  ended: "muted",
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
export const toneOf = <K extends string>(map: Record<K, Tone>, key: string | null | undefined): Tone =>
  (key != null && (map as Record<string, Tone>)[key]) || "muted";
