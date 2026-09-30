// Subscription plan definitions and pure billing logic. Prices are in
// GEL/month. A plan is bought one month at a time through Flitt
// (lib/billing/flitt.ts); the verified payment callback sets the plan and
// extends `paidUntil`. The plan applies while it is paid, plus GRACE_DAYS;
// after that the account falls back to the trial (if still running) or the
// bottom tier. Nothing is deleted — only adding past the limits stops.

export type AccountType = "personal" | "business";

export interface PlanDef {
  id: string;
  kind: AccountType;
  priceGel: number;
  maxAssets: number;
  maxUnits: number;
  /** Team seats including the owner (personal plans: 1). */
  maxMembers: number;
  /** Pro investment analysis (5-year underwriting) included? */
  analysis: boolean;
}

export const TRIAL_DAYS = 30;

export const PLANS: PlanDef[] = [
  { id: "starter", kind: "personal", priceGel: 15, maxAssets: 5, maxUnits: 3, maxMembers: 1, analysis: false },
  { id: "standard", kind: "personal", priceGel: 29, maxAssets: 20, maxUnits: 10, maxMembers: 1, analysis: true },
  { id: "pro", kind: "personal", priceGel: 49, maxAssets: 50, maxUnits: 30, maxMembers: 1, analysis: true },
  { id: "biz_s", kind: "business", priceGel: 99, maxAssets: 100, maxUnits: 60, maxMembers: 5, analysis: true },
  { id: "biz_m", kind: "business", priceGel: 199, maxAssets: 300, maxUnits: 200, maxMembers: 15, analysis: true },
];

export const planById = (id: string | null | undefined): PlanDef | null =>
  PLANS.find((plan) => plan.id === id) ?? null;

export const plansFor = (kind: AccountType): PlanDef[] =>
  PLANS.filter((plan) => plan.kind === kind);

/** Top tier of an account type — what the free trial grants. */
export const trialPlan = (kind: AccountType): PlanDef =>
  plansFor(kind)[plansFor(kind).length - 1];

/** Bottom tier — the fallback when the trial ends with no plan chosen. */
export const fallbackPlan = (kind: AccountType): PlanDef => plansFor(kind)[0];

export const trialDaysLeft = (
  trialEndsAt: Date | null | undefined,
  now: Date,
): number =>
  trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000))
    : 0;

export interface BillingState {
  accountType: AccountType;
  plan: string | null;
  trialEndsAt: Date | null;
  /** Paid through this moment (the Flitt callback extends it). */
  paidUntil: Date | null;
  /** The shared public demo keeps its showcase plan without payment. */
  complimentary?: boolean;
}

/** Days a lapsed plan keeps working, so a late renewal loses nothing. */
export const GRACE_DAYS = 3;

export const graceEndsAt = (paidUntil: Date): Date =>
  new Date(paidUntil.getTime() + GRACE_DAYS * 86_400_000);

/**
 * Where the chosen plan stands:
 *   paid      — paid through a date still ahead;
 *   grace     — the date has passed, the grace days have not;
 *   expired   — a plan was bought, but it ran out;
 *   none      — no plan chosen (or one that does not fit the account type);
 *   complimentary — the demo.
 */
export type PlanStanding = "paid" | "grace" | "expired" | "none" | "complimentary";

export function planStanding(state: BillingState, now: Date): PlanStanding {
  const chosen = planById(state.plan);
  if (!chosen || chosen.kind !== state.accountType) return "none";
  if (state.complimentary) return "complimentary";
  if (!state.paidUntil) return "expired";
  if (now < state.paidUntil) return "paid";
  if (now < graceEndsAt(state.paidUntil)) return "grace";
  return "expired";
}

/**
 * The plan whose limits currently apply:
 * chosen plan, paid (or in its grace days) → that plan;
 * otherwise an active trial → top tier; otherwise → bottom tier (can't add
 * past its limits). A plan chosen before payments existed (no paidUntil)
 * counts as unpaid.
 */
export function effectivePlan(state: BillingState, now: Date): PlanDef {
  const standing = planStanding(state, now);
  const chosen = planById(state.plan);
  if (chosen && (standing === "paid" || standing === "grace" || standing === "complimentary")) {
    return chosen;
  }
  if (trialDaysLeft(state.trialEndsAt, now) > 0) return trialPlan(state.accountType);
  return fallbackPlan(state.accountType);
}

/**
 * `months` calendar months later, in UTC, keeping the time of day; a day
 * the target month does not have is clamped to its last day (31 Jan → 28
 * or 29 Feb, never 3 March).
 */
export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * The new paid-through date after one more paid month: counted from the
 * current paid-through date while it is still ahead (renewing early loses
 * no days), otherwise from now.
 */
export function renewedUntil(paidUntil: Date | null, now: Date, months = 1): Date {
  const from = paidUntil && paidUntil > now ? paidUntil : now;
  return addMonthsUtc(from, months);
}

/**
 * The paid-through date after paying one month of `newPlanId`, given the
 * plan and date the account holds now.
 *
 * - Same plan (a renewal): the month is added after the current date while
 *   it is still ahead — renewing early loses no days.
 * - Another plan while the old one is still paid: the unused time is worth
 *   money, so it is converted at the two prices first (remaining time ×
 *   old price ÷ new price, counted from now), then the month is added. Ten
 *   prepaid Starter months (150 GEL) buy about three Pro months, not ten;
 *   a Pro owner who moves to Starter gets more Starter time for what is
 *   left, never less.
 * - Nothing paid ahead (lapsed, grace days, never paid, unknown plan):
 *   counted from now.
 */
export function paidUntilAfterPayment(
  current: { plan: string | null; paidUntil: Date | null },
  newPlanId: string,
  now: Date,
  months = 1,
): Date {
  const { paidUntil } = current;
  // Same plan, or nothing paid ahead: a plain renewal.
  if (!paidUntil || paidUntil <= now || current.plan === newPlanId) {
    return renewedUntil(paidUntil, now, months);
  }

  const oldPlan = planById(current.plan);
  const newPlan = planById(newPlanId);
  if (!oldPlan || !newPlan || newPlan.priceGel <= 0) return addMonthsUtc(now, months);

  const remainingMs = paidUntil.getTime() - now.getTime();
  const creditMs = Math.floor((remainingMs * oldPlan.priceGel) / newPlan.priceGel);
  return addMonthsUtc(new Date(now.getTime() + creditMs), months);
}

/** Adding one more is allowed while strictly under the limit. */
export const underLimit = (current: number, max: number): boolean => current < max;
