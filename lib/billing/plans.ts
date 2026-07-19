// Subscription plan definitions and pure billing logic. Prices are in
// GEL/month. Payments are integrated in a later stage — until then,
// choosing a plan activates it immediately (the trial and limits are
// still fully enforced so the product behaves like the real thing).

export type AccountType = "personal" | "business";

export interface PlanDef {
  id: string;
  kind: AccountType;
  priceGel: number;
  maxAssets: number;
  maxUnits: number;
  /** Team seats including the owner (personal plans: 1). */
  maxMembers: number;
}

export const TRIAL_DAYS = 30;

export const PLANS: PlanDef[] = [
  { id: "starter", kind: "personal", priceGel: 15, maxAssets: 5, maxUnits: 3, maxMembers: 1 },
  { id: "standard", kind: "personal", priceGel: 29, maxAssets: 20, maxUnits: 10, maxMembers: 1 },
  { id: "pro", kind: "personal", priceGel: 49, maxAssets: 50, maxUnits: 30, maxMembers: 1 },
  { id: "biz_s", kind: "business", priceGel: 99, maxAssets: 100, maxUnits: 60, maxMembers: 5 },
  { id: "biz_m", kind: "business", priceGel: 199, maxAssets: 300, maxUnits: 200, maxMembers: 15 },
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
}

/**
 * The plan whose limits currently apply:
 * chosen plan → that plan; no plan + active trial → top tier;
 * no plan + expired trial → bottom tier (can't add past its limits).
 */
export function effectivePlan(state: BillingState, now: Date): PlanDef {
  const chosen = planById(state.plan);
  if (chosen && chosen.kind === state.accountType) return chosen;
  if (trialDaysLeft(state.trialEndsAt, now) > 0) return trialPlan(state.accountType);
  return fallbackPlan(state.accountType);
}

/** Adding one more is allowed while strictly under the limit. */
export const underLimit = (current: number, max: number): boolean => current < max;
